import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import {
  getHistoriaClinicaContext,
  searchClinicalPatients,
} from '../services/historia-clinica-support.service.js';

const searchPatientsQuerySchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    id_salita: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  .strict();

export const obtenerContextoClinicoController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getHistoriaClinicaContext(req.user!);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const buscarPacientesClinicosController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const query = searchPatientsQuerySchema.parse(req.query);
    const data = await searchClinicalPatients(req.user!, {
      page: query.page,
      limit: query.limit,
      search: query.search ?? '',
      ...(query.id_salita ? { id_salita: query.id_salita } : {}),
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
