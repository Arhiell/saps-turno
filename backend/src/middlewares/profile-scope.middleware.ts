import type {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  supabase,
} from '../config/supabase.js';

import {
  getTurnoScope,
  assertTurnoScope,
} from '../services/turno-access.service.js';

import {
  findPatientById,
  findPatientDetailsByDni,
} from '../repositories/patient-read.repository.js';

import {
  AppError,
} from '../utils/app-error.js';

import {
  agendaDateTime,
} from '../utils/turno-time.js';

// ========================================
// ALCANCE DE PACIENTES
// ========================================

// Verifica que el paciente pertenezca a una salita
// administrada por el usuario autenticado.
export const patientScope = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Obtiene las salitas permitidas para el usuario.
    const scope = await getTurnoScope(
      req.user!
    );

    res.locals.salitaScope = scope;

    // Valida la salita enviada en el cuerpo.
    if (req.body?.id_salita_asignada) {
      assertTurnoScope(
        scope,
        req.body.id_salita_asignada
      );
    }

    // Si existe un alcance limitado, valida al paciente.
    if (scope !== null) {
      const patient = req.params.id
        ? await findPatientById(
            String(req.params.id)
          )
        : req.params.dni
          ? await findPatientDetailsByDni(
              String(req.params.dni)
            )
          : null;

      // Verifica que la salita del paciente esté permitida.
      if (patient) {
        assertTurnoScope(
          scope,
          patient.id_salita_asignada
        );
      }

      // Al crear un paciente debe indicarse su salita.
      if (
        req.method === 'POST' &&
        !req.body?.id_salita_asignada
      ) {
        throw new AppError(
          'Indicá la salita asignada',
          400
        );
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};


// ========================================
// ALCANCE DE PROFESIONALES
// ========================================

// Verifica que el profesional pertenezca a una
// de las salitas administradas por el usuario.
export const professionalScope = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Obtiene las salitas permitidas.
    const scope = await getTurnoScope(
      req.user!
    );

    res.locals.salitaScope = scope;

    // Un alcance null no necesita restricciones adicionales.
    if (scope === null) {
      next();
      return;
    }

    // Valida la salita enviada en el cuerpo.
    if (req.body?.id_salita) {
      assertTurnoScope(
        scope,
        req.body.id_salita
      );
    }

    // Valida la salita enviada como parámetro.
    if (req.params.idSalita) {
      assertTurnoScope(
        scope,
        String(req.params.idSalita)
      );
    }

    // Obtiene la fecha actual utilizada por la agenda.
    const today = agendaDateTime(
      new Date()
    ).date;

    // Busca profesionales con asignaciones vigentes
    // dentro de las salitas permitidas.
    const {
      data,
      error,
    } = await supabase
      .from('profesional_salita')
      .select('id_profesional')
      .in('id_salita', scope)
      .eq('activo', true)
      .lte('fecha_desde', today)
      .or(
        `fecha_hasta.is.null,fecha_hasta.gte.${today}`
      );

    if (error) {
      throw error;
    }

    // Obtiene únicamente los IDs de profesionales permitidos.
    const ids = (data ?? []).map(
      (row) => String(row.id_profesional)
    );

    res.locals.professionalScope = ids;

    // Obtiene el profesional desde parámetros o body.
    const id =
      req.params.id ??
      req.body?.id_profesional;

    // Verifica que el profesional esté dentro del alcance.
    if (
      id &&
      !ids.includes(String(id))
    ) {
      throw new AppError(
        'El profesional no pertenece a tus salitas',
        403
      );
    }

    // Impide continuar si el usuario no tiene salitas asignadas.
    if (scope.length === 0) {
      throw new AppError(
        'No tenés salitas asignadas',
        403
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};


// ========================================
// ALCANCE DE AGENDA
// ========================================

// Valida el alcance para horarios,
// bloqueos de agenda y disponibilidad.
export const scheduleScope = (
  table:
    | 'horarios_atencion'
    | 'bloqueos_agenda'
    | 'disponibilidad'
) =>
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      /*
       * La disponibilidad del paciente valida
       * cobertura e identidad desde su servicio.
       */
      if (
        table === 'disponibilidad' &&
        req.user!.rol === 'PACIENTE'
      ) {
        next();
        return;
      }

      // Obtiene las salitas permitidas para el usuario.
      const scope = await getTurnoScope(
        req.user!
      );

      res.locals.salitaScope = scope;

      // Aplica restricciones cuando existe un alcance definido.
      if (scope !== null) {
        const salita =
          req.body?.id_salita ??
          req.query.id_salita;

        // Valida la salita enviada en body o query.
        if (salita) {
          assertTurnoScope(
            scope,
            String(salita)
          );
        }

        /*
         * Para edición o consulta por ID,
         * obtiene la salita asociada al registro.
         */
        if (
          req.params.id &&
          table !== 'disponibilidad'
        ) {
          const key =
            table === 'horarios_atencion'
              ? 'id_horario'
              : 'id_bloqueo';

          const {
            data,
            error,
          } = await supabase
            .from(table)
            .select('id_salita')
            .eq(
              key,
              String(req.params.id)
            )
            .maybeSingle();

          if (error) {
            throw error;
          }

          // Verifica que el registro pertenezca al alcance.
          if (data) {
            assertTurnoScope(
              scope,
              data.id_salita
            );
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };