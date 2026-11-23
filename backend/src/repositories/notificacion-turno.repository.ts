import { supabase } from "../config/supabase.js";
import { AppError } from "../utils/app-error.js";
import { agendaDateTime } from '../utils/turno-time.js';

// Solo responsables con permiso vigente reciben nuevos avisos dentro del sistema.
export const findTutorUsersByTurno = async (idTurno: string): Promise<string[]> => {
  const { data: turno, error } = await supabase.from('turnos').select('id_paciente').eq('id_turno', idTurno).maybeSingle();
  if (error) throw error;
  if (!turno) return [];
  const today = agendaDateTime(new Date()).date;
  const { data: relations, error: relationError } = await supabase.from('paciente_tutores')
    .select('id_tutor').eq('id_paciente', turno.id_paciente).eq('puede_gestionar_turnos', true)
    .eq('identidad_verificada', true).eq('documentacion_verificada', true)
    .eq('autorizacion_verificada', true)
    .lte('fecha_desde', today).or(`fecha_hasta.is.null,fecha_hasta.gte.${today}`);
  if (relationError) throw relationError;
  if (!relations?.length) return [];
  const { data: tutors, error: tutorError } = await supabase.from('tutores').select('id_persona')
    .in('id_tutor', relations.map(row => row.id_tutor)).eq('activo', true);
  if (tutorError) throw tutorError;
  if (!tutors?.length) return [];
  const { data: users, error: userError } = await supabase.from('usuarios').select('id_usuario')
    .in('id_persona', tutors.map(row => row.id_persona)).eq('activo', true);
  if (userError) throw userError;
  return (users ?? []).map(row => row.id_usuario);
};

// Busca el usuario asociado al paciente dueño del turno.
export const findUsuarioByTurno = async (
  idTurno: string,
) => {
  const { data: turno, error: turnoError } = await supabase
    .from("turnos")
    .select(`
      id_turno,
      id_paciente,
      pacientes!inner (
        id_persona
      )
    `)
    .eq("id_turno", idTurno)
    .maybeSingle();

  if (turnoError) {
    throw new AppError(
      "No se pudo obtener el paciente del turno",
      500,
    );
  }

  if (!turno) {
    return null;
  }

  const paciente = Array.isArray(turno.pacientes)
    ? turno.pacientes[0]
    : turno.pacientes;

  if (!paciente?.id_persona) {
    return null;
  }

  const { data: usuario, error: usuarioError } = await supabase
    .from("usuarios")
    .select("id_usuario")
    .eq("id_persona", paciente.id_persona)
    .eq("activo", true)
    .maybeSingle();

  if (usuarioError) {
    throw new AppError(
      "No se pudo obtener el usuario del paciente",
      500,
    );
  }

  return usuario?.id_usuario ?? null;
};

export const findTurnoEmailContextById = async (
  idTurno: string,
) => {
  const { data, error } = await supabase
    .from("turnos")
    .select(`
      id_turno,
      codigo_turno,
      fecha_hora_inicio,
      fecha_hora_fin,

      paciente:pacientes(
        id_paciente,
        persona:personas(
          nombres,
          apellidos,
          email
        )
      ),

      profesional:profesionales(
        id_profesional,
        matricula,
        persona:personas(
          nombres,
          apellidos
        )
      ),

      especialidad:especialidades(
        id_especialidad,
        nombre
      ),

      salita:salitas(
        id_salita,
        nombre,
        direccion,
        telefono,
        id_barrio
      )
    `)
    .eq("id_turno", idTurno)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "No se pudo obtener el contexto del turno para la notificación",
      500,
    );
  }

  if (!data) {
    return null;
  }

  const salita = Array.isArray(data.salita)
    ? data.salita[0]
    : data.salita;

  if (!salita?.id_barrio) {
    return {
      ...data,
      zona: null,
    };
  }

  const { data: barrio, error: barrioError } = await supabase
    .from("barrios")
    .select(`
      id_barrio,
      id_zona
    `)
    .eq("id_barrio", salita.id_barrio)
    .maybeSingle();

  if (barrioError) {
    throw new AppError(
      "No se pudo obtener el barrio de la salita",
      500,
    );
  }

  if (!barrio?.id_zona) {
    return {
      ...data,
      zona: null,
    };
  }

  const { data: zona, error: zonaError } = await supabase
    .from("zonas")
    .select(`
      id_zona,
      nombre
    `)
    .eq("id_zona", barrio.id_zona)
    .maybeSingle();

  if (zonaError) {
    throw new AppError(
      "No se pudo obtener la zona de la salita",
      500,
    );
  }

  return {
    ...data,
    zona,
  };
};
