import type {
  Request,
  Response,
  NextFunction
} from "express";

import {
  createPatientSchema
} from "../validators/patient.validator.js";

import {
  registerPatient
} from "../services/patient.service.js";

/**
 * POST /api/patients
 * Registra un paciente.
 */
export const createPatientController = async (
    req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = createPatientSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Datos del paciente inválidos",
          errors: validation.error.flatten().fieldErrors,
        });
      }

      const patient = await registerPatient(validation.data);

      return res.status(201).json({
        success: true,
        message: "Paciente registrado correctamente",
        data: {
          patient,
        },
      });
    } catch (error) {
      next(error);
    }
};
