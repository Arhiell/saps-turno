import {
  supabase,
} from '../config/supabase.js';

// Define los datos de vigencia de una asignación.
interface Vigencia {
  activo: boolean;
  fecha_desde: string;
  fecha_hasta: string | null;
}

// Estructura pública del profesional disponible para un paciente.
export interface PatientProfessional {
  id_profesional: string;
  matricula: string;

  persona: {
    nombres: string;
    apellidos: string;
  };

  // Salitas asignadas al profesional.
  salitas: (
    Vigencia & {
      id_salita: string;
    }
  )[];

  // Especialidades asignadas al profesional.
  especialidades: (
    Vigencia & {
      id_especialidad: string;

      especialidad: {
        nombre: string;
        activo: boolean;
      };
    }
  )[];
}

// Proyección pública:
// omite DNI, domicilio, contacto y datos de otros pacientes.
export const findPatientProfessionals = async (
  salita: string
) => {
  const {
    data,
    error,
  } = await supabase
    .from('profesionales')
    .select(`
      id_profesional,
      matricula,
      persona:personas!inner(
        nombres,
        apellidos
      ),
      salitas:profesional_salita!inner(
        id_salita,
        activo,
        fecha_desde,
        fecha_hasta
      ),
      especialidades:profesional_especialidad(
        id_especialidad,
        activo,
        fecha_desde,
        fecha_hasta,
        especialidad:especialidades(
          nombre,
          activo
        )
      )
    `)
    // Solo profesionales activos.
    .eq('activo', true)
    .eq('persona.activo', true)

    // Limita los profesionales a la salita indicada.
    .eq(
      'salitas.id_salita',
      salita
    )
    .returns<PatientProfessional[]>();

  if (error) {
    throw error;
  }

  // Devuelve un arreglo vacío si no existen resultados.
  return data ?? [];
};