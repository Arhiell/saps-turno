import type {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  obtenerDisponibilidadAdministrativa,
} from '../services/disponibilidad.service.js';

import {
  getPatientAvailability,
  getPatientAvailableDates,
} from '../services/patient-agenda.service.js';

import {
  disponibilidadQuerySchema,
} from '../validators/disponibilidad.validator.js';

export const obtenerFechasPaciente = async (
  req: Request, res: Response, next: NextFunction,
) => {
  try {
    const query = disponibilidadQuerySchema.omit({ fecha: true }).parse(req.query);
    res.json(await getPatientAvailableDates(req.user!, query));
  } catch (error) {
    next(error);
  }
};

// Obtiene la disponibilidad de turnos según el rol del usuario.
export const obtenerDisponibilidadController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Los pacientes utilizan su consulta de disponibilidad específica.
    if (req.user!.rol === 'PACIENTE') {
      // Valida los parámetros recibidos por query.
      const query = disponibilidadQuerySchema.parse(
        req.query
      );

      res.json(
        await getPatientAvailability(
          req.user!,
          query
        )
      );

      return;
    }

    // Para otros roles obtiene la disponibilidad general.
    const disponibilidad =
      await obtenerDisponibilidadAdministrativa({
        fecha: String(
          req.query.fecha ?? ''
        ),

        id_profesional: String(
          req.query.id_profesional ?? ''
        ),

        id_especialidad: String(
          req.query.id_especialidad ?? ''
        ),

        id_salita: String(
          req.query.id_salita ?? ''
        ),
        ...(req.query.id_turno !== undefined ? { id_turno: req.query.id_turno } : {}),
      }, req.user!);

    return res
      .status(200)
      .json(disponibilidad);
  } catch (error) {
    // Envía el error al middleware global.
    next(error);
  }
};
