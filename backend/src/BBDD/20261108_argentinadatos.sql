-- Aplicar manualmente después de 20261107_cierres_calendario.sql.
BEGIN;
ALTER TABLE public.cierres_calendario
  ADD COLUMN fuente_externa text CHECK (fuente_externa = 'ARGENTINADATOS'),
  ADD COLUMN clave_externa text,
  ADD COLUMN datos_externos jsonb;
ALTER TABLE public.cierres_calendario ALTER COLUMN creado_por DROP NOT NULL;
ALTER TABLE public.cierres_calendario ADD CONSTRAINT ck_cierre_fuente CHECK (
  (fuente_externa IS NULL AND clave_externa IS NULL AND datos_externos IS NULL AND creado_por IS NOT NULL)
  OR (fuente_externa IS NOT NULL AND fuente_externa = 'ARGENTINADATOS' AND clave_externa IS NOT NULL AND datos_externos IS NOT NULL
    AND tipo = 'FERIADO_NACIONAL' AND alcance = 'GLOBAL' AND id_salita IS NULL
    AND fecha_inicio = fecha_fin AND dia_completo AND activo)
);
CREATE UNIQUE INDEX ux_cierre_fuente_clave ON public.cierres_calendario(fuente_externa,clave_externa)
  WHERE fuente_externa IS NOT NULL;

-- Estado persistente y lease compartido entre instancias; no es otro calendario.
CREATE TABLE public.calendario_sincronizacion (
  fuente text PRIMARY KEY CHECK (fuente = 'ARGENTINADATOS'),
  token uuid, lease_hasta timestamptz,
  ultimo_intento timestamptz, ultimo_exito timestamptz,
  modo text CHECK (modo IN ('AUTOMATICA','MANUAL')),
  id_usuario uuid REFERENCES public.usuarios(id_usuario),
  resumen jsonb NOT NULL DEFAULT '{}'::jsonb
);
INSERT INTO public.calendario_sincronizacion(fuente) VALUES ('ARGENTINADATOS');
ALTER TABLE public.calendario_sincronizacion ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendario_sincronizacion FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.calendario_sincronizacion TO service_role;
CREATE TRIGGER tr_auditar_calendario_sync AFTER UPDATE ON public.calendario_sincronizacion
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('fuente');

CREATE FUNCTION public.reclamar_calendario_sync(p_manual boolean, p_usuario uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE s public.calendario_sincronizacion; nuevo uuid := gen_random_uuid();
  local_now timestamp := now() AT TIME ZONE 'America/Argentina/Buenos_Aires';
  sabado timestamp;
BEGIN
  IF p_manual IS NULL THEN RAISE EXCEPTION 'Modo de sincronización requerido'; END IF;
  IF p_manual AND NOT EXISTS (SELECT 1 FROM public.usuarios u JOIN public.roles r USING(id_rol)
    WHERE u.id_usuario=p_usuario AND u.activo AND r.activo AND r.codigo='SUPER_ADMIN') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Solo SUPER_ADMIN puede sincronizar';
  END IF;
  IF NOT p_manual AND p_usuario IS NOT NULL THEN RAISE EXCEPTION 'Actor automático inválido'; END IF;
  SELECT * INTO s FROM public.calendario_sincronizacion WHERE fuente='ARGENTINADATOS' FOR UPDATE;
  IF s.lease_hasta > now() THEN RETURN NULL; END IF;
  sabado := date_trunc('week',local_now) + interval '5 days 3 hours';
  IF sabado > local_now THEN sabado := sabado - interval '7 days'; END IF;
  -- Un fallo finalizado se reintenta el sábado siguiente o manualmente.
  -- Un proceso interrumpido se recupera al vencer su lease.
  IF NOT p_manual AND s.token IS NULL AND s.ultimo_intento >=
      (sabado AT TIME ZONE 'America/Argentina/Buenos_Aires') THEN RETURN NULL; END IF;
  PERFORM set_config('app.current_user_id',coalesce(p_usuario::text,''),true);
  PERFORM set_config('app.current_salita_id','',true);
  UPDATE public.calendario_sincronizacion SET token=nuevo,lease_hasta=now()+interval '5 minutes',
    ultimo_intento=now(),modo=CASE WHEN p_manual THEN 'MANUAL' ELSE 'AUTOMATICA' END,
    id_usuario=p_usuario,resumen=jsonb_build_object('estado','EN_CURSO') WHERE fuente=s.fuente;
  RETURN nuevo;
END;
$$;

-- Los importados se escriben exclusivamente mediante la RPC de sincronización.
CREATE OR REPLACE FUNCTION public.validar_cierre_calendario()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE sync_valida boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.calendario_sincronizacion s WHERE s.fuente='ARGENTINADATOS'
    AND s.token::text = current_setting('app.calendario_sync_token',true) AND s.lease_hasta > now()) INTO sync_valida;
  IF NEW.fuente_externa IS NOT NULL OR (TG_OP='UPDATE' AND OLD.fuente_externa IS NOT NULL) THEN
    IF NOT sync_valida THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='El feriado importado es de solo lectura';
    END IF;
    -- El feriado entra en vigor aunque haya turnos: quedan pendientes, no se mueven.
  ELSIF EXISTS (SELECT 1 FROM public.cierre_turnos_afectados(to_jsonb(NEW))) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='AGENDA_CONFLICT';
  END IF;
  NEW.fecha_actualizacion := now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.aplicar_feriados_argentinadatos(p_token uuid,p_anio integer,p_filas jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE s public.calendario_sincronizacion; fila record; actual public.cierres_calendario;
  nuevos integer:=0; actualizados integer:=0; iguales integer:=0;
  coincidencias integer:=0; pendientes integer; ausentes integer; anio_actual integer;
BEGIN
  -- Mismo orden en todas las escrituras: lock de agenda antes de filas.
  PERFORM pg_advisory_xact_lock(20261103,1);
  SELECT * INTO s FROM public.calendario_sincronizacion WHERE fuente='ARGENTINADATOS' FOR UPDATE;
  IF s.token IS DISTINCT FROM p_token OR p_token IS NULL OR s.lease_hasta IS NULL OR s.lease_hasta <= now() THEN
    RAISE EXCEPTION 'La ejecución de sincronización venció';
  END IF;
  anio_actual := extract(year FROM now() AT TIME ZONE 'America/Argentina/Buenos_Aires');
  IF p_anio IS NULL OR p_anio NOT IN (anio_actual,anio_actual+1) OR jsonb_typeof(p_filas) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_filas) NOT BETWEEN 1 AND 366 THEN RAISE EXCEPTION 'Respuesta inválida'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_filas) AS x(fecha date,nombre text,tipo text)
    WHERE fecha IS NULL OR extract(year FROM fecha)<>p_anio OR nombre IS NULL OR length(trim(nombre)) NOT BETWEEN 3 AND 150
      OR tipo IS NULL OR tipo NOT IN ('inamovible','trasladable','puente')) THEN RAISE EXCEPTION 'Feriado inválido'; END IF;
  PERFORM set_config('app.calendario_sync_token',p_token::text,true);
  PERFORM set_config('app.current_user_id',coalesce(s.id_usuario::text,''),true);
  PERFORM set_config('app.current_salita_id','',true);
  FOR fila IN SELECT fecha,string_agg(DISTINCT nombre,' / ' ORDER BY nombre) AS titulo,
    jsonb_agg(jsonb_build_object('fecha',fecha,'nombre',nombre,'tipo',tipo) ORDER BY nombre,tipo) AS datos
    FROM jsonb_to_recordset(p_filas) AS x(fecha date,nombre text,tipo text) GROUP BY fecha ORDER BY fecha
  LOOP
    SELECT * INTO actual FROM public.cierres_calendario WHERE fuente_externa='ARGENTINADATOS' AND clave_externa=fila.fecha::text FOR UPDATE;
    IF actual.id_cierre IS NULL THEN
      INSERT INTO public.cierres_calendario(titulo,tipo,alcance,fecha_inicio,fecha_fin,dia_completo,origen,creado_por,
        fuente_externa,clave_externa,datos_externos)
      VALUES(left(fila.titulo,150),'FERIADO_NACIONAL','GLOBAL',fila.fecha,fila.fecha,true,'API_ARGENTINADATOS',s.id_usuario,
        'ARGENTINADATOS',fila.fecha::text,fila.datos);
      nuevos:=nuevos+1;
    ELSIF actual.titulo IS DISTINCT FROM left(fila.titulo,150) OR actual.datos_externos IS DISTINCT FROM fila.datos THEN
      UPDATE public.cierres_calendario SET titulo=left(fila.titulo,150),datos_externos=fila.datos WHERE id_cierre=actual.id_cierre;
      actualizados:=actualizados+1;
    ELSE iguales:=iguales+1;
    END IF;
    IF EXISTS (SELECT 1 FROM public.cierres_calendario c WHERE c.fuente_externa IS NULL AND c.activo
      AND c.tipo='FERIADO_NACIONAL' AND c.alcance='GLOBAL' AND c.dia_completo
      AND c.fecha_inicio=fila.fecha AND c.fecha_fin=fila.fecha) THEN coincidencias:=coincidencias+1; END IF;
  END LOOP;
  SELECT count(DISTINCT t.id_turno) INTO pendientes FROM public.cierres_calendario c
    CROSS JOIN LATERAL public.cierre_turnos_afectados(to_jsonb(c)) t
    WHERE c.fuente_externa='ARGENTINADATOS' AND extract(year FROM c.fecha_inicio)=p_anio;
  SELECT count(*) INTO ausentes FROM public.cierres_calendario c WHERE c.fuente_externa='ARGENTINADATOS'
    AND extract(year FROM c.fecha_inicio)=p_anio AND NOT EXISTS
      (SELECT 1 FROM jsonb_array_elements(p_filas) x WHERE x->>'fecha'=c.clave_externa);
  RETURN jsonb_build_object('anio',p_anio,'estado','OK','nuevos',nuevos,'actualizados',actualizados,
    'sin_cambios',iguales,'coincidencias_manuales',coincidencias,'turnos_pendientes',pendientes,'no_recibidos_conservados',ausentes);
END;
$$;
CREATE FUNCTION public.finalizar_calendario_sync(p_token uuid,p_resumen jsonb,p_exito boolean)
RETURNS boolean LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE s public.calendario_sincronizacion;
BEGIN
  SELECT * INTO s FROM public.calendario_sincronizacion WHERE fuente='ARGENTINADATOS' FOR UPDATE;
  IF s.token IS DISTINCT FROM p_token OR p_token IS NULL OR s.lease_hasta IS NULL OR s.lease_hasta <= now() THEN RETURN false; END IF;
  PERFORM set_config('app.current_user_id',coalesce(s.id_usuario::text,''),true);
  PERFORM set_config('app.current_salita_id','',true);
  UPDATE public.calendario_sincronizacion SET token=NULL,lease_hasta=NULL,resumen=p_resumen,
    ultimo_exito=CASE WHEN p_exito THEN now() ELSE ultimo_exito END WHERE fuente=s.fuente;
  RETURN true;
END;
$$;
CREATE FUNCTION public.cierres_importados_pendientes(p_salitas uuid[] DEFAULT NULL)
RETURNS TABLE(id_cierre uuid,cantidad bigint) LANGUAGE sql STABLE SET search_path = public,pg_temp AS $$
  SELECT c.id_cierre,count(t.id_turno) FROM public.cierres_calendario c
    CROSS JOIN LATERAL public.cierre_turnos_afectados(to_jsonb(c)) t
  WHERE c.fuente_externa='ARGENTINADATOS' AND (p_salitas IS NULL OR t.id_salita=ANY(p_salitas))
  GROUP BY c.id_cierre;
$$;

-- Se conserva validar_turno_cierre: no permite confirmar/reactivar/reservar
-- sobre el feriado. Cancelar o reprogramar hacia un destino válido sigue el flujo existente.
REVOKE ALL ON FUNCTION public.reclamar_calendario_sync(boolean,uuid),public.aplicar_feriados_argentinadatos(uuid,integer,jsonb),
 public.finalizar_calendario_sync(uuid,jsonb,boolean),public.cierres_importados_pendientes(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reclamar_calendario_sync(boolean,uuid),public.aplicar_feriados_argentinadatos(uuid,integer,jsonb),
 public.finalizar_calendario_sync(uuid,jsonb,boolean),public.cierres_importados_pendientes(uuid[]) TO service_role;
COMMIT;
NOTIFY pgrst,'reload schema';
