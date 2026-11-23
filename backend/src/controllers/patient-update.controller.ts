import type {
  Request,
  Response,
  NextFunction
} from "express";

import {
  patientIdSchema
} from "../validators/patient-query.validator.js";

import {
  patientStatusSchema,
  updatePatientSchema,
} from "../validators/patient-update.validator.js";

import {
  changePatientStatus,
  editPatient
} from "../services/patient-update.service.js";

/**
 * PATCH /api/patients/:id
 */
export const updatePatientController = async (
  req: Request, res: Response, next: NextFunction) => {
    try {
      const paramsValidation = patientIdSchema.safeParse(req.params);

      if (!paramsValidation.success) {
        return res.status(400).json({
          success: false,
          message: "ID del paciente inválido",
        });
      }

      const bodyValidation = updatePatientSchema.safeParse(req.body);

      if (!bodyValidation.success) {
        return res.status(400).json({
          success: false,
          message: "Datos de actualización inválidos",
          errors: bodyValidation.error.flatten().fieldErrors,
        });
      }

      const patient = await editPatient(paramsValidation.data.id, bodyValidation.data);

      return res.status(200).json({
        success: true,
        message: "Paciente actualizado correctamente",
        data: {
          patient,
        },
      });
    } catch (error) {
      next(error);
    }
};

/**
 * PATCH /api/patients/:id/status
 */
export const updatePatientStatusController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const paramsValidation = patientIdSchema.safeParse(req.params);

    if (!paramsValidation.success) {
      return res.status(400).json({
        success: false,
        message: "ID del paciente inválido",
      });
    }

    const bodyValidation = patientStatusSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Estado del paciente inválido",
      });
    }

    const patient = await changePatientStatus(
      paramsValidation.data.id,
      bodyValidation.data.activo
    );

    return res.status(200).json({
      success: true,
      message: bodyValidation.data.activo
        ? "Paciente activado correctamente"
        : "Paciente desactivado correctamente",
      data: {
        patient,
      },
    });
  } catch (error) {
    next(error);
  }
};
