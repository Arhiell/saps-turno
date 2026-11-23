import {
  getAllBarrios,
  getBarrioById,
  createBarrio,
  updateBarrio,
  deleteBarrio
} from "../repositories/barrio.repository.js";
import { emitirCambioTerritorial } from "./socket.service.js";

export const getBarrios = async () => {
  return await getAllBarrios();
};

export const getBarrio = async (id: string) => {
  return await getBarrioById(id);
};

export const crearBarrio = async (barrio: {
  id_zona: string;
  nombre: string;
  codigo_postal?: string | null;
  activo?: boolean;
}) => {
  const result = await createBarrio(barrio);
  try {
    emitirCambioTerritorial({
      tipo: 'BARRIO_CREADO',
      mensaje: `Nuevo barrio creado: ${barrio.nombre}`,
      id_barrio: result?.id_barrio,
      id_zona: barrio.id_zona,
    });
  } catch {
    // Silencioso
  }
  return result;
};

export const actualizarBarrio = async (
  id: string,
  barrio: {
    id_zona?: string;
    nombre?: string;
    codigo_postal?: string | null;
    activo?: boolean;
  }
) => {
  const result = await updateBarrio(id, barrio);
  try {
    emitirCambioTerritorial({
      tipo: 'BARRIO_ACTUALIZADO',
      mensaje: `Barrio actualizado`,
      id_barrio: id,
      id_zona: barrio.id_zona,
    });
  } catch {
    // Silencioso
  }
  return result;
};

export const eliminarBarrio = async (id: string) => {
  const result = await deleteBarrio(id);
  try {
    emitirCambioTerritorial({
      tipo: 'BARRIO_ELIMINADO',
      mensaje: `Barrio eliminado`,
      id_barrio: id,
    });
  } catch {
    // Silencioso
  }
  return result;
};