import type {
  RequestHandler
} from "express";
import {
  tutorIdSchema
} from "../validators/tutor-query.validator.js";
import {
   updateTutorSchema,
   tutorStatusSchema
  } from "../validators/tutor-update.validator.js";
import {
  editTutor,
  changeTutorStatus
} from "../services/tutor-update.service.js";

// Valida los datos personales antes de delegar la actualización.
export const updateTutorController: RequestHandler = async (req, res, next) => {
  const params = tutorIdSchema.safeParse(req.params);
  const body = updateTutorSchema.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      success: false,
      message: "Datos de actualizacion invalidos"
    });
    return;
  }
  try {
    res.json
    ({
      success: true,
      data:
      {
        tutor: await editTutor(params.data.id, body.data)
      }
    });
  }
  catch (error) {
    next(error);
  }
};
// Cambia el estado del perfil, sin modificar el estado de la persona.
export const updateTutorStatusController:
  RequestHandler = async (req, res, next) => {
    const params = tutorIdSchema.safeParse(req.params);
    const body = tutorStatusSchema.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      success: false,
      message: "Estado o UUID invalido"
    });
    return;
  }
  try {
    res.json({
      success: true,
    data: {
      tutor: await changeTutorStatus(
        params.data.id,
        body.data.activo)
      }
    });
  }
  catch (error)
  {
    next(error);
  }
};
