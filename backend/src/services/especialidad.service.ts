import {
  getAllEspecialidades,
  getEspecialidadById,
  createEspecialidad,
  updateEspecialidad,
  deleteEspecialidad
} from "../repositories/especialidad.repository.js";

export const getEspecialidades = async () => {
  return await getAllEspecialidades();
};

export const getEspecialidad = async (id: string) => {
  return await getEspecialidadById(id);
};

export const crearEspecialidad = async (especialidad: {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  requiere_profesional: boolean;
  activo?: boolean;
}) => {
  return await createEspecialidad(especialidad);
};

export const actualizarEspecialidad = async (
  id: string,
  especialidad: {
    codigo?: string;
    nombre?: string;
    descripcion?: string | null;
    requiere_profesional?: boolean;
    activo?: boolean;
  }
) => {
  return await updateEspecialidad(id, especialidad);
};

export const eliminarEspecialidad = async (id: string) => {
  return await deleteEspecialidad(id);
};