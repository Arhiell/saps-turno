import type { 
  RequestHandler 
} from "express";

import { 
  createTurnoSchema 
} from "../validators/turno.validator.js";

import { 
  createTurno 
} from "../services/turno.service.js";
import { getOwnEntity } from '../services/auth-profile.service.js';

// Los errores de Zod y AppError llegan al middleware global de Express 5.
export const createTurnoController: RequestHandler = async (req, res) => {
  let body = req.body;
  if (req.user!.rol === 'PACIENTE') {
    const parsed = createTurnoSchema.omit({ observaciones: true }).partial({ id_paciente: true }).parse(req.body);
    body = { ...parsed, id_paciente: parsed.id_paciente ?? (await getOwnEntity(req.user!)).id };
  }
  const input = createTurnoSchema.parse(body);
  const turno = await createTurno(input, req.user!);
  res.status(201).json(
    { 
      success: true,
      message: "Turno creado", data: { turno } 
    }
  );
};
