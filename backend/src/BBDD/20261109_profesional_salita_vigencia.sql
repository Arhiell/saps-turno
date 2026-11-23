-- Reemplaza la validación existente sin alterar tablas, datos ni triggers.
-- Aplicar después de las migraciones de agenda y calendario institucional.
BEGIN;
CREATE OR REPLACE FUNCTION public.validar_turno()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_horario public.horarios_atencion%ROWTYPE;
    v_fecha_local DATE;
    v_hora_inicio TIME;
    v_hora_fin TIME;
    v_cantidad INTEGER;
BEGIN
    IF NOT NEW.ocupa_agenda THEN
        RETURN NEW;
    END IF;

    -- La agenda municipal se interpreta con la zona horaria argentina.
    v_fecha_local := (NEW.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
    v_hora_inicio := (NEW.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::time;
    v_hora_fin := (NEW.fecha_hora_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::time;

    -- La asociación debe ser vigente para el día del turno, con o sin horario.
    -- Bloquea cambios de la relación hasta terminar esta escritura.
    PERFORM 1 FROM public.profesional_salita ps
     WHERE ps.id_profesional = NEW.id_profesional
       AND ps.id_salita = NEW.id_salita
       AND ps.activo
       AND ps.fecha_desde <= v_fecha_local
       AND (ps.fecha_hasta IS NULL OR ps.fecha_hasta >= v_fecha_local)
     FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El profesional no esta habilitado para esa especialidad o salita';
    END IF;

    IF NEW.id_horario IS NOT NULL THEN
        SELECT * INTO v_horario
          FROM public.horarios_atencion
         WHERE id_horario = NEW.id_horario AND activo
         FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El horario seleccionado no existe o esta inactivo';
        END IF;

        IF v_horario.id_profesional <> NEW.id_profesional
           OR v_horario.id_especialidad <> NEW.id_especialidad
           OR v_horario.id_salita <> NEW.id_salita THEN
            RAISE EXCEPTION 'El turno no coincide con el profesional, especialidad o salita del horario';
        END IF;

        IF EXTRACT(ISODOW FROM v_fecha_local)::SMALLINT <> v_horario.dia_semana
           OR v_fecha_local < v_horario.vigencia_desde
           OR (v_horario.vigencia_hasta IS NOT NULL AND v_fecha_local > v_horario.vigencia_hasta)
           OR v_hora_inicio < v_horario.hora_inicio
           OR v_hora_fin > v_horario.hora_fin THEN
            RAISE EXCEPTION 'El turno esta fuera de la vigencia o franja del horario';
        END IF;

        IF EXTRACT(EPOCH FROM (NEW.fecha_hora_fin - NEW.fecha_hora_inicio)) / 60
           <> v_horario.duracion_turno_minutos THEN
            RAISE EXCEPTION 'La duracion del turno no coincide con el horario configurado';
        END IF;

        IF MOD(
            (EXTRACT(EPOCH FROM (v_hora_inicio - v_horario.hora_inicio)) / 60)::INTEGER,
            v_horario.duracion_turno_minutos
        ) <> 0 THEN
            RAISE EXCEPTION 'La hora de inicio no coincide con un bloque valido de la agenda';
        END IF;

        IF v_horario.cupo_maximo_diario IS NOT NULL THEN
            SELECT COUNT(*) INTO v_cantidad
              FROM public.turnos t
             WHERE t.id_horario = NEW.id_horario
               AND t.ocupa_agenda
               AND (t.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = v_fecha_local
               AND t.id_turno <> NEW.id_turno;

            IF v_cantidad >= v_horario.cupo_maximo_diario THEN
                RAISE EXCEPTION 'Se alcanzo el cupo maximo diario del horario';
            END IF;
        END IF;
    ELSE
        -- Los turnos manuales igualmente requieren asociaciones vigentes.
        IF NOT EXISTS (
            SELECT 1 FROM public.profesional_especialidad pe
             WHERE pe.id_profesional = NEW.id_profesional
               AND pe.id_especialidad = NEW.id_especialidad AND pe.activo
        ) THEN
            RAISE EXCEPTION 'El profesional no esta habilitado para esa especialidad o salita';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM public.bloqueos_agenda b
         WHERE b.activo
           AND b.id_salita = NEW.id_salita
           AND b.fecha = v_fecha_local
           AND (b.id_profesional IS NULL OR b.id_profesional = NEW.id_profesional)
           AND (b.id_especialidad IS NULL OR b.id_especialidad = NEW.id_especialidad)
           AND (b.dia_completo OR (v_hora_inicio < b.hora_fin AND v_hora_fin > b.hora_inicio))
    ) THEN
        RAISE EXCEPTION 'La agenda esta bloqueada para la fecha y horario solicitados';
    END IF;

    RETURN NEW;
END;
$$;
COMMIT;
