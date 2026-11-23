-- Aplicar una vez sobre la base existente. No elimina ni modifica sanciones previas.
BEGIN;

CREATE INDEX IF NOT EXISTS ix_sanciones_paciente_vigentes
ON public.sanciones (id_paciente, fecha_fin DESC) WHERE NOT anulada;

-- La especialidad conserva el origen de la sanción; el impedimento es global.
CREATE OR REPLACE FUNCTION public.validar_sancion_turno()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Confirmar/llegada de una reserva ya existente no crea una reserva nueva.
    IF TG_OP = 'UPDATE' THEN
        IF OLD.ocupa_agenda AND NEW.id_paciente = OLD.id_paciente
           AND NEW.id_especialidad = OLD.id_especialidad
           AND NEW.fecha_hora_inicio = OLD.fecha_hora_inicio THEN
            RETURN NEW;
        END IF;
    END IF;
    -- Serializa las reservas y las nuevas sanciones del mismo paciente.
    PERFORM 1 FROM public.pacientes WHERE id_paciente = NEW.id_paciente FOR UPDATE;
    IF NEW.ocupa_agenda AND EXISTS (
        SELECT 1 FROM public.sanciones s
        WHERE s.id_paciente = NEW.id_paciente AND NOT s.anulada
          AND s.fecha_inicio <= CURRENT_TIMESTAMP AND s.fecha_fin > CURRENT_TIMESTAMP
    ) THEN
        RAISE EXCEPTION 'PATIENT_SANCTIONED'
            USING HINT = 'El paciente tiene una sanción vigente para todas las especialidades.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sancionar_inasistencia_turno()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.id_estado IS DISTINCT FROM OLD.id_estado AND EXISTS (
        SELECT 1 FROM public.estados_turno WHERE id_estado = NEW.id_estado AND codigo = 'NO_ASISTIO'
    ) THEN
        IF NEW.fecha_hora_inicio > CURRENT_TIMESTAMP THEN
            RAISE EXCEPTION 'No se puede registrar una inasistencia antes del inicio del turno';
        END IF;
        PERFORM 1 FROM public.pacientes WHERE id_paciente = NEW.id_paciente FOR UPDATE;
        INSERT INTO public.sanciones
            (id_paciente, id_especialidad, id_turno, motivo, fecha_inicio, fecha_fin)
        VALUES (NEW.id_paciente, NEW.id_especialidad, NEW.id_turno,
            'Inasistencia a un turno. Suspensión de reservas en todas las especialidades por siete días.',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '168 hours')
        ON CONFLICT (id_turno) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_turnos_sancionar_inasistencia ON public.turnos;
CREATE TRIGGER tr_turnos_sancionar_inasistencia
AFTER UPDATE OF id_estado ON public.turnos
FOR EACH ROW EXECUTE FUNCTION public.sancionar_inasistencia_turno();

COMMIT;
