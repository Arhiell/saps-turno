import type {
  NextFunction,
  Request,
  Response,
} from 'express';

import {
  canViewAccount,
} from '../repositories/account-display.select.js';

import {
  patientDniSchema,
  patientIdSchema,
  patientListQuerySchema,
} from '../validators/patient-query.validator.js';

import {
  getPatientByDni,
  getPatientById,
  getPatients,
} from '../services/patient-read.service.js';

// Lista los pacientes según los filtros y el alcance de la salita.
export const listPatientsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Valida los parámetros de consulta.
    const validation =
      patientListQuerySchema.safeParse(
        req.query
      );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message:
          'Parámetros de consulta inválidos',
        errors:
          validation.error
            .flatten()
            .fieldErrors,
      });
    }

    // Obtiene los pacientes respetando el alcance y permisos.
    const result =
      await getPatients(
        validation.data,
        res.locals.salitaScope,
        canViewAccount(req.user!)
      );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Obtiene un paciente por su identificador.
export const getPatientController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Valida el identificador recibido.
    const validation =
      patientIdSchema.safeParse(
        req.params
      );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message:
          'ID del paciente inválido',
      });
    }

    // Obtiene el paciente según los permisos del usuario.
    const patient =
      await getPatientById(
        validation.data.id,
        canViewAccount(req.user!)
      );

    return res.status(200).json({
      success: true,
      data: {
        patient,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Obtiene un paciente mediante su DNI.
export const getPatientByDniController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Valida el DNI recibido.
    const validation =
      patientDniSchema.safeParse(
        req.params
      );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message:
          'DNI del paciente inválido',
      });
    }

    // Obtiene el paciente según los permisos del usuario.
    const patient =
      await getPatientByDni(
        validation.data.dni,
        canViewAccount(req.user!)
      );

    return res.status(200).json({
      success: true,
      data: {
        patient,
      },
    });
  } catch (error) {
    next(error);
  }
};