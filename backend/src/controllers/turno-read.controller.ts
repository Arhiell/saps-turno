import type { 
  RequestHandler 
} from "express";

import { 
  turnoIdSchema, 
  turnoQuerySchema 
} from "../validators/turno-query.validator.js";

import { 
  getTurno, 
  getTurnos 
} from "../services/turno-read.service.js";

// Valida filtros antes de construir consultas y limita la paginación.
export const listTurnosController: RequestHandler = async (req, res) => {
  const filters = turnoQuerySchema.parse(req.query);
  res.json(
    { 
      success: true, 
      data: await getTurnos(filters, req.user!) 
    }
  );
};
export const getTurnoController: RequestHandler = async (req, res) => {
  const { id } = turnoIdSchema.parse(req.params);
  res.json(
    { 
      success: true, 
      data: { turno: await getTurno(id, req.user!) } 
    }
  );
};
