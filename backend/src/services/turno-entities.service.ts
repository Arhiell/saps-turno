import { assertClinicSpecialty } from './configuracion.service.js';
import { 
  getPatientById 
} from "./patient-read.service.js";

import {
  getProfesionalById
} from "../repositories/profesional.repository.js";

import { 
  getSalitaById 
} from "../repositories/salita.repository.js";

import { 
  getEspecialidadById 
} from "../repositories/especialidad.repository.js";

import { 
  getEspecialidadesByProfesional 
} from "../repositories/profesional-especialidad.repository.js";

import { 
  getSalitasByProfesional 
} from "../repositories/profesional-salita.repository.js";

import type { 
  CreateTurnoInput 
} from "../validators/turno.validator.js";

import { 
  AppError 
} from "../utils/app-error.js";

const requireActive = (
  entity: { activo: boolean } | null, name: string) => {
    if (!entity) throw new AppError(`${name} no encontrado`, 404);
    
    if (!entity.activo) throw new AppError(`${name} debe estar activo`, 400);
};

const vigente = (row: { 
  activo: boolean; 
  fecha_desde: string; 
  fecha_hasta: string | null }, 
  date: string) =>
    row.activo && row.fecha_desde <= date && (
      row.fecha_hasta === null || row.fecha_hasta >= date
    );

// Usa las lecturas del equipo y comprueba las asociaciones en la fecha del turno.
export const validateTurnoEntities = async (
  input: CreateTurnoInput, 
  date: string, enforceClinicSpecialty = true) => {
    if (enforceClinicSpecialty) await assertClinicSpecialty(input.id_salita, input.id_especialidad);
    requireActive(await getPatientById(input.id_paciente), "Paciente");
    
    requireActive(await getProfesionalById(input.id_profesional), "Profesional");
    
    requireActive(await getSalitaById(input.id_salita), "Salita");
    
    requireActive(await getEspecialidadById(input.id_especialidad), "Especialidad");
    
    const specialties = await getEspecialidadesByProfesional(input.id_profesional);
    
    const salitas = await getSalitasByProfesional(input.id_profesional);
    
    if (!specialties?.some(row => row.id_especialidad === input.id_especialidad && vigente(row, date))) {
    throw new AppError(
      "El profesional no está habilitado para esa especialidad en la fecha solicitada",
      400
    );
  }

  if (!salitas?.some(row => row.id_salita === input.id_salita && vigente(row, date))) {
    throw new AppError(
      "El profesional no trabaja en esa salita en la fecha solicitada",
      400
    );
  }
};
