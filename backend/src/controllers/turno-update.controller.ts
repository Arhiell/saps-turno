import type { 
  RequestHandler 
} from "express";

import { 
  turnoIdSchema 
} from "../validators/turno-query.validator.js";

import { 
  updateTurnoSchema, 
  turnoStatusSchema 
} from "../validators/turno-update.validator.js";

import { 
  updateTurno, 
  changeTurnoStatus 
} from "../services/turno-update.service.js";

// El servicio distingue cambios de agenda y estado; el controller solo valida la entrada.
export const updateTurnoController: RequestHandler = async (req, res) => {
  const { id } = turnoIdSchema.parse(req.params);
  const input = updateTurnoSchema.parse(req.body);
  res.json(
    {
       success: true, 
       data: { turno: await updateTurno(id, input, req.user!) }
    }
  );
};

export const changeTurnoStatusController: RequestHandler = async (req, res) => {
  const { id } = turnoIdSchema.parse(req.params);
  const input = turnoStatusSchema.parse(req.body);
  res.json(
    { 
      success: true, 
      data: { turno: await changeTurnoStatus(id, input, req.user!) }
    }
  );
};
