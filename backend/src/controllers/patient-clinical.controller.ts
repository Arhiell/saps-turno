import type { RequestHandler } from 'express';
import { z } from 'zod';
import { getOwnHistoriaClinica } from '../services/patient-clinical.service.js';

const patientHistoryQuerySchema = z.object({
  id_paciente: z.string().uuid().optional(),
});

export const getMiHistoriaClinicaController: RequestHandler = async (req, res, next) => {
  try {
    const { id_paciente } = patientHistoryQuerySchema.parse(req.query);

    res.setHeader('Cache-Control', 'no-store');

    const data = await getOwnHistoriaClinica(req.user!, id_paciente);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
