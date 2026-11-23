import type {
  RequestHandler,
} from 'express';

import { z } from 'zod';

import {
  getPatientProfessionals,
} from '../services/patient-agenda.service.js';

// Obtiene los profesionales disponibles para un paciente.
export const patientProfessionals: RequestHandler = async (
  req,
  res,
  next
) => {
  // Si el usuario no es paciente, continúa con el siguiente middleware.
  if (req.user!.rol !== 'PACIENTE') {
    next();
    return;
  }

  // Valida la fecha recibida por query.
  const {
    fecha,
    id_paciente,
  } = z
    .object({
      fecha: z.string().date().optional(),
      id_paciente: z.string().uuid().optional(),
    })
    .strict()
    .parse(req.query);

  // Devuelve los profesionales disponibles para la fecha indicada.
  res.json({
    success: true,
    data: await getPatientProfessionals(
      req.user!,
      fecha,
      id_paciente
    ),
  });
};
