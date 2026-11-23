import {
  getAllZonas,
  getZonaById,
  createZona,
  updateZona,
  deleteZona
} from "../repositories/zona.repository.js";
import { emitirCambioTerritorial } from "./socket.service.js";

export const getZonas = async () => {
  return await getAllZonas();
};

export const getZona = async (id: string) => {
  return await getZonaById(id);
};

export const crearZona = async (zona: {
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
}) => {
  const result = await createZona(zona);
  try {
    emitirCambioTerritorial({
      tipo: 'ZONA_CREADA',
      mensaje: `Nueva zona creada: ${zona.nombre}`,
      id_zona: result?.id_zona,
    });
  } catch {
    // Silencioso
  }
  return result;
};

export const actualizarZona = async (
  id: string,
  zona: {
    nombre?: string;
    descripcion?: string | null;
    activo?: boolean;
  }
) => {
  const result = await updateZona(id, zona);
  try {
    emitirCambioTerritorial({
      tipo: 'ZONA_ACTUALIZADA',
      mensaje: `Zona actualizada`,
      id_zona: id,
    });
  } catch {
    // Silencioso
  }
  return result;
};

export const eliminarZona = async (id: string) => {
  const result = await deleteZona(id);
  try {
    emitirCambioTerritorial({
      tipo: 'ZONA_ELIMINADA',
      mensaje: `Zona eliminada`,
      id_zona: id,
    });
  } catch {
    // Silencioso
  }
  return result;
};