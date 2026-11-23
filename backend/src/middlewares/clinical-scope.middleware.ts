import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import {
  verifyClinicalAuditAccess,
  verifyClinicalDerivationScope,
  verifyClinicalPatientAccess,
  verifyClinicalResourceSalitaAccess,
} from '../services/clinical-scope.service.js';
import type { ClinicalPermissionCode } from '../types/permission.types.js';
import { AppError } from '../utils/app-error.js';
import { agendaDateTime } from '../utils/turno-time.js';

type RequestSource = 'params' | 'body' | 'query';

export interface ClinicalScopeOptions {
  permiso: ClinicalPermissionCode;
  patientIdFrom?: RequestSource;
  patientIdField?: string;
  salitaIdFrom?: RequestSource;
  salitaIdField?: string;
  especialidadIdFrom?: RequestSource;
  especialidadIdField?: string;
  fechaActoFrom?: Exclude<RequestSource, 'params'>;
  fechaActoField?: string;
  requiereLongitudinal?: boolean | 'whenNoEspecialidad';
}

const uuidSchema = z.string().uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const readField = (
  req: Request,
  source: RequestSource | undefined,
  field: string | undefined,
  fallbacks: unknown[]
): unknown => {
  if (source && field) {
    const bag = req[source] as Record<string, unknown> | undefined;
    return bag?.[field];
  }

  return fallbacks.find((value) => value !== undefined && value !== null && value !== '');
};

const parseRequiredUuid = (raw: unknown, label: string): string => {
  const parsed = uuidSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(`${label} inválido o faltante`, 400);
  }
  return parsed.data;
};

const parseOptionalUuid = (raw: unknown, label: string): string | null => {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }

  const parsed = uuidSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(`${label} inválido`, 400);
  }
  return parsed.data;
};

const parseOptionalActDate = (raw: unknown): string | null => {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }

  if (typeof raw !== 'string') {
    throw new AppError('Fecha del acto clínico inválida', 400);
  }

  const trimmed = raw.trim();
  if (dateSchema.safeParse(trimmed).success) {
    return trimmed;
  }

  const parsedTime = Date.parse(trimmed);
  if (Number.isNaN(parsedTime)) {
    throw new AppError('Fecha del acto clínico inválida', 400);
  }

  return agendaDateTime(new Date(parsedTime)).date;
};

/**
 * Middleware de alcance clínico para endpoints de Historia Clínica.
 * Debe ubicarse después de `authenticate` y `requirePermission(...)`:
 * `authenticate -> requirePermission(...) -> clinicalScope(...) -> controller`
 *
 * Nunca confía en `id_usuario`, `rol` ni `id_profesional` enviados en la petición.
 */
export const clinicalScope = (
  options: ClinicalScopeOptions
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id_usuario || !req.user.rol) {
        return next(new AppError('Usuario no autenticado', 401));
      }

      const isReadAccess = options.permiso === 'VER_HISTORIA_CLINICA';
      const isAuthorizedRole =
        req.user.rol === 'PROFESIONAL' ||
        (isReadAccess && (req.user.rol === 'ADMIN_SALITA' || req.user.rol === 'RECEPCION'));

      if (!isAuthorizedRole) {
        return next(
          new AppError(
            isReadAccess
              ? 'Acceso clínico no autorizado para este rol'
              : 'Acceso clínico restringido a profesionales con perfil vinculado',
            403
          )
        );
      }

      if (req.user.rol === 'PROFESIONAL' && !req.user.id_persona) {
        return next(
          new AppError(
            'Acceso clínico restringido a profesionales con perfil vinculado',
            403
          )
        );
      }

      const rawPatientId = readField(
        req,
        options.patientIdFrom,
        options.patientIdField,
        [
          req.params?.idPaciente,
          req.params?.patientId,
          req.body?.id_paciente,
          req.query?.id_paciente,
        ]
      );

      const rawSalitaId = readField(
        req,
        options.salitaIdFrom,
        options.salitaIdField,
        [
          req.params?.idSalita,
          req.body?.id_salita,
          req.query?.id_salita,
        ]
      );

      const rawEspecialidadId = readField(
        req,
        options.especialidadIdFrom,
        options.especialidadIdField,
        [req.body?.id_especialidad, req.query?.id_especialidad]
      );

      const rawFechaActo = readField(
        req,
        options.fechaActoFrom,
        options.fechaActoField,
        [req.body?.fecha_acto, req.body?.fecha_atencion, req.query?.fecha_acto]
      );

      const isAdvanceTurnoDraft =
        req.method === 'POST' &&
        req.path === '/consultas' &&
        req.body?.firmar === false &&
        Boolean(req.body?.id_turno);

      const idPaciente = parseRequiredUuid(rawPatientId, 'Identificador de paciente');
      const idSalita = parseRequiredUuid(rawSalitaId, 'Identificador de salita');
      const idEspecialidad = parseOptionalUuid(
        rawEspecialidadId,
        'Identificador de especialidad'
      );
      const fechaActo = isAdvanceTurnoDraft ? null : parseOptionalActDate(rawFechaActo);

      const requiereLongitudinal =
        options.requiereLongitudinal === 'whenNoEspecialidad'
          ? idEspecialidad === null
          : (options.requiereLongitudinal ?? false);

      const scope = await verifyClinicalPatientAccess({
        user: req.user,
        idPaciente,
        idSalita,
        permiso: options.permiso,
        fechaActo,
        idEspecialidad,
        requiereLongitudinal,
      });

      res.locals.clinicalScope = scope;
      return next();
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }

      const pgErr = error as { code?: string; message?: string; details?: string; hint?: string };
      console.error('[clinicalScope-error]', JSON.stringify({
        code: pgErr?.code ?? null,
        message: pgErr?.message ?? (error instanceof Error ? error.message : null),
        details: pgErr?.details ?? null,
        hint: pgErr?.hint ?? null,
      }));
      return next(new AppError('Error interno del servidor', 500));
    }
  };
};

/**
 * Middleware de alcance para consulta de auditoría clínica (`VER_AUDITORIA_CLINICA`).
 * Debe ubicarse después de `authenticate` y `requirePermission(CLINICAL_PERMISSIONS.VER_AUDITORIA_CLINICA)`.
 */
export const clinicalAuditScope = (): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id_usuario || !req.user.rol) {
        return next(new AppError('Usuario no autenticado', 401));
      }

      const rawSalitaId = req.query?.id_salita ?? req.params?.idSalita;
      const idSalita = parseOptionalUuid(rawSalitaId, 'Identificador de salita');

      const scope = await verifyClinicalAuditAccess({
        user: req.user,
        idSalita,
      });

      res.locals.clinicalAuditScope = scope;
      return next();
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }

      console.error('[clinicalAuditScope]', error);
      return next(new AppError('Error interno del servidor', 500));
    }
  };
};

/**
 * Middleware de alcance clínico para recursos identificados por ID propio
 * (consulta médica, evolución o estudio clínico).
 * Verifica rol PROFESIONAL, vigencia en la salita y, si se envía `id_paciente`,
 * valida además `verificar_acceso_clinico` con el permiso indicado.
 */
export const clinicalResourceScope = (options: {
  permiso: ClinicalPermissionCode;
}): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id_usuario || !req.user.rol) {
        return next(new AppError('Usuario no autenticado', 401));
      }

      const isReadAccess = options.permiso === 'VER_HISTORIA_CLINICA';
      const isAuthorizedRole =
        req.user.rol === 'PROFESIONAL' ||
        (isReadAccess && (req.user.rol === 'ADMIN_SALITA' || req.user.rol === 'RECEPCION'));

      if (!isAuthorizedRole) {
        return next(
          new AppError(
            isReadAccess
              ? 'Acceso clínico no autorizado para este rol'
              : 'Acceso clínico restringido a profesionales con perfil vinculado',
            403
          )
        );
      }

      if (req.user.rol === 'PROFESIONAL' && !req.user.id_persona) {
        return next(
          new AppError(
            'Acceso clínico restringido a profesionales con perfil vinculado',
            403
          )
        );
      }

      const rawSalitaId =
        req.body?.id_salita ?? req.query?.id_salita ?? req.params?.idSalita;
      const idSalita = parseRequiredUuid(rawSalitaId, 'Identificador de salita');

      const rawPatientId = req.body?.id_paciente ?? req.query?.id_paciente;
      const idPaciente = parseOptionalUuid(
        rawPatientId,
        'Identificador de paciente'
      );

      if (idPaciente) {
        const scope = await verifyClinicalPatientAccess({
          user: req.user,
          idPaciente,
          idSalita,
          permiso: options.permiso,
          requiereLongitudinal: false,
        });
        res.locals.clinicalScope = scope;
        res.locals.clinicalResourceScope = { id_salita: idSalita, id_paciente: idPaciente };
      } else {
        res.locals.clinicalResourceScope =
          await verifyClinicalResourceSalitaAccess({
            user: req.user,
            idSalita,
          });
      }

      return next();
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }

      console.error('[clinicalResourceScope]', error);
      return next(new AppError('Error interno del servidor', 500));
    }
  };
};

/**
 * Middleware de alcance de salita para listar o resolver derivaciones clínicas.
 */
export const clinicalDerivationScope = (): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id_usuario || !req.user.rol) {
        return next(new AppError('Usuario no autenticado', 401));
      }

      const rawSalitaId =
        req.body?.id_salita ?? req.query?.id_salita ?? req.params?.idSalita;
      const idSalita = parseRequiredUuid(rawSalitaId, 'Identificador de salita');

      res.locals.clinicalDerivationScope = await verifyClinicalDerivationScope({
        user: req.user,
        idSalita,
      });

      return next();
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }

      console.error('[clinicalDerivationScope]', error);
      return next(new AppError('Error interno del servidor', 500));
    }
  };
};
