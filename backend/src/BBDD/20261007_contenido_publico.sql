-- Ejecutar después de SAPS_Turno_BBDD3_FINAL.sql. No modifica notificaciones privadas.
BEGIN;
CREATE TABLE public.categorias_publicas (
  id_categoria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(80) NOT NULL UNIQUE,
  es_aviso BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO public.categorias_publicas(nombre, es_aviso) VALUES
  ('Salud', false), ('Vacunación', false), ('Atención', false), ('Campañas', false),
  ('Prevención', false), ('Comunidad', false), ('Avisos', true);
CREATE TABLE public.noticias_publicas (
  id_noticia UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(160) NOT NULL CHECK (length(trim(titulo)) > 0),
  resumen VARCHAR(300) NOT NULL CHECK (length(trim(resumen)) > 0),
  contenido TEXT NOT NULL CHECK (length(contenido) BETWEEN 1 AND 20000),
  imagen_url VARCHAR(2048),
  id_autor UUID NOT NULL REFERENCES public.usuarios(id_usuario),
  id_salita UUID REFERENCES public.salitas(id_salita),
  id_categoria UUID NOT NULL REFERENCES public.categorias_publicas(id_categoria),
  estado VARCHAR(12) NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR','PUBLICADA','ARCHIVADA')),
  destacada BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_publicacion TIMESTAMPTZ,
  fecha_finalizacion TIMESTAMPTZ,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (estado <> 'PUBLICADA' OR fecha_publicacion IS NOT NULL),
  CHECK (fecha_finalizacion IS NULL OR fecha_finalizacion > fecha_publicacion)
);
CREATE INDEX ix_noticias_publicas_vigencia ON public.noticias_publicas(estado, fecha_publicacion DESC);
CREATE INDEX ix_noticias_publicas_autor ON public.noticias_publicas(id_autor, id_salita);
ALTER TABLE public.categorias_publicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noticias_publicas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.categorias_publicas, public.noticias_publicas FROM anon, authenticated;
GRANT ALL ON public.categorias_publicas, public.noticias_publicas TO service_role;
CREATE TRIGGER tr_auditar_noticias_publicas AFTER INSERT OR UPDATE ON public.noticias_publicas
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_noticia');

-- Conserva autoría, valida alcance nuevamente y atribuye la auditoría al actor real.
CREATE FUNCTION public.guardar_noticia_publica(actor UUID, noticia_id UUID, datos JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  rol_actor TEXT;
  anterior public.noticias_publicas%ROWTYPE;
  destino UUID := NULLIF(datos->>'id_salita', '')::UUID;
  resultado UUID;
BEGIN
  SELECT r.codigo INTO rol_actor FROM public.usuarios u JOIN public.roles r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = actor AND u.activo;
  IF rol_actor IS NULL OR rol_actor NOT IN ('SUPER_ADMIN','ADMIN_SALITA') THEN
    RAISE EXCEPTION 'Sin permisos para administrar publicaciones';
  END IF;
  IF noticia_id IS NOT NULL THEN
    SELECT * INTO anterior FROM public.noticias_publicas WHERE id_noticia = noticia_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La noticia no existe'; END IF;
  END IF;
  IF rol_actor = 'ADMIN_SALITA' THEN
    IF destino IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.usuario_salita WHERE id_usuario = actor AND id_salita = destino AND activo
        AND fecha_desde <= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
        AND (fecha_hasta IS NULL OR fecha_hasta >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)
    ) THEN RAISE EXCEPTION 'Salita fuera de alcance'; END IF;
    IF noticia_id IS NOT NULL AND (anterior.id_autor <> actor OR anterior.id_salita IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.usuario_salita WHERE id_usuario = actor AND id_salita = anterior.id_salita AND activo
        AND fecha_desde <= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
        AND (fecha_hasta IS NULL OR fecha_hasta >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)
    )) THEN RAISE EXCEPTION 'Publicación fuera de alcance'; END IF;
  END IF;
  PERFORM set_config('app.current_user_id', actor::text, true);
  PERFORM set_config('app.current_salita_id', coalesce(destino::text, ''), true);
  IF noticia_id IS NULL THEN
    INSERT INTO public.noticias_publicas(titulo,resumen,contenido,imagen_url,id_autor,id_salita,id_categoria,
      estado,destacada,fecha_publicacion,fecha_finalizacion)
    VALUES(datos->>'titulo',datos->>'resumen',datos->>'contenido',datos->>'imagen_url',actor,destino,
      (datos->>'id_categoria')::uuid,datos->>'estado',(datos->>'destacada')::boolean,
      (datos->>'fecha_publicacion')::timestamptz,(datos->>'fecha_finalizacion')::timestamptz)
    RETURNING id_noticia INTO resultado;
  ELSE
    UPDATE public.noticias_publicas SET titulo=datos->>'titulo',resumen=datos->>'resumen',contenido=datos->>'contenido',
      imagen_url=datos->>'imagen_url',id_salita=destino,id_categoria=(datos->>'id_categoria')::uuid,
      estado=datos->>'estado',destacada=(datos->>'destacada')::boolean,
      fecha_publicacion=(datos->>'fecha_publicacion')::timestamptz,
      fecha_finalizacion=(datos->>'fecha_finalizacion')::timestamptz,fecha_actualizacion=now()
    WHERE id_noticia=noticia_id RETURNING id_noticia INTO resultado;
  END IF;
  RETURN resultado;
END;
$$;
REVOKE ALL ON FUNCTION public.guardar_noticia_publica(UUID,UUID,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_noticia_publica(UUID,UUID,JSONB) TO service_role;
COMMIT;
