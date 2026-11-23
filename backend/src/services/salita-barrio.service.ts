import {
  getAllSalitaBarrios,
  getBarriosBySalita,
  getSalitasByBarrio,
  createSalitaBarrio,
  updateSalitaBarrio,
  deleteSalitaBarrio
} from "../repositories/salita-barrio.repository.js";
import { emitirCambioTerritorial } from "./socket.service.js";

export const getSalitaBarrios = async () => {
  return await getAllSalitaBarrios();
};

export const getBarriosDeSalita = async (idSalita: string) => {
  return await getBarriosBySalita(idSalita);
};

export const getSalitasDeBarrio = async (idBarrio: string) => {
  return await getSalitasByBarrio(idBarrio);
};

export const crearSalitaBarrio = async (relacion: {
  id_salita: string;
  id_barrio: string;
  es_barrio_sede?: boolean;
  activo?: boolean;
  fecha_desde: string;
  fecha_hasta?: string | null;
}) => {
  const result = await createSalitaBarrio(relacion);
  try {
    emitirCambioTerritorial({
      tipo: 'COBERTURA_ACTUALIZADA',
      mensaje: `Cobertura territorial actualizada`,
      id_salita: relacion.id_salita,
      id_barrio: relacion.id_barrio,
    });
  } catch {
    // Silencioso
  }
  return result;
};

export const actualizarSalitaBarrio = async (
  idSalita: string,
  idBarrio: string,
  relacion: {
    es_barrio_sede?: boolean;
    activo?: boolean;
    fecha_desde?: string;
    fecha_hasta?: string | null;
  }
) => {
  const result = await updateSalitaBarrio(idSalita, idBarrio, relacion);
  try {
    emitirCambioTerritorial({
      tipo: 'COBERTURA_ACTUALIZADA',
      mensaje: `Cobertura territorial modificada`,
      id_salita: idSalita,
      id_barrio: idBarrio,
    });
  } catch {
    // Silencioso
  }
  return result;
};

export const eliminarSalitaBarrio = async (
  idSalita: string,
  idBarrio: string
) => {
  const result = await deleteSalitaBarrio(idSalita, idBarrio);
  try {
    emitirCambioTerritorial({
      tipo: 'COBERTURA_ACTUALIZADA',
      mensaje: `Cobertura territorial dada de baja`,
      id_salita: idSalita,
      id_barrio: idBarrio,
    });
  } catch {
    // Silencioso
  }
  return result;
};