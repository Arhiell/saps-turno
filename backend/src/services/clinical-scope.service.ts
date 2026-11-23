import {
  findActiveClinicalSalita,
  hasActiveProfesionalSalitaScope,
  hasActiveUserSalitaScope,
  verifyClinicalAccessRpc,
} from '../repositories/clinical-scope.repository.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import type {
  ClinicalAuditScopeContext,
  ClinicalPermissionCode,
  ClinicalScopeContext,
} from '../types/permission.types.js';
import { AppError } from '../utils/app-error.js';
import { agendaDateTime } from '../utils/turno-time.js';

interface PostgresLikeError {
  code?: string;
  message?: string;
}

export const mapClinicalRpcError = (error: unknown): AppError | null => {
  const pgError = error as PostgresLikeError | null;
  if (!pgError?.code) {
    return null;
  }

  if (pgError.code === '42501') {
    return new AppError(
      pgError.message || 'No tenés alcance clínico autorizado para esta operación',
      403
    );
  }

  if (pgError.code === 'P0002') {
    return new AppError(
      pgError.message || 'Recurso clínico no encontrado',
      404
    );
  }

  if (pgError.code === '22023') {
    return new AppError(
      pgError.message || 'Parámetros clínicos inválidos',
      400
    );
  }

  if (pgError.code === '23505') {
    const customDuplicate =
      pgError.message && /Ya existe una consulta/i.test(pgError.message)
        ? pgError.message
        : null;
    return new AppError(
      customDuplicate ||
        'Ya existe un registro clínico asociado para la referencia indicada',
      409
    );
  }

  if (pgError.code === '23503' || pgError.code === '23514' || pgError.code === '22P02') {
    return new AppError(
      pgError.message || 'Los datos clínicos enviados no cumplen las reglas de la base de datos',
      400
    );
  }

  if (pgError.code === '40001') {
    return new AppError(
      pgError.message ||
        'El borrador fue modificado en otra sesión o pestaña.',
      409,
      'BORRADOR_CONFLICT'
    );
  }

  if (pgError.code === 'P0001' && pgError.message) {
    const msg = pgError.message;
    if (/CONFLICTO_VERSION_BORRADOR/i.test(msg)) {
      return new AppError(
        msg.replace(/^CONFLICTO_VERSION_BORRADOR:\s*/i, ''),
        409,
        'BORRADOR_CONFLICT'
      );
    }
    if (
      /inmutable|definitiva|no admite modificaciones/i.test(msg)
    ) {
      return new AppError(msg, 409);
    }
    if (
      /autoautorizar|requiere una derivación|no posee asociación vigente|no está habilitado|acceso clínico restringido|no autorizado/i.test(
        msg
      )
    ) {
      return new AppError(msg, 403);
    }
    return new AppError(msg, 400);
  }

  return null;
};

/**
 * Valida el alcance clínico asistencial del usuario autenticado.
 * Restringe el acceso exclusivamente al rol `PROFESIONAL` con perfil vinculado
 * y delega en `verificar_acceso_clinico` la validación de salita, especialidad y derivación.
 */
export const verifyClinicalPatientAccess = async (params: {
  user: AuthenticatedUser;
  idPaciente: string;
  idSalita: string;
  permiso: ClinicalPermissionCode;
  fechaActo?: string | null;
  idEspecialidad?: string | null;
  requiereLongitudinal?: boolean;
}): Promise<ClinicalScopeContext> => {
  const isReadAccess = params.permiso === 'VER_HISTORIA_CLINICA';
  const isAuthorizedRole =
    params.user.rol === 'PROFESIONAL' ||
    (isReadAccess && (params.user.rol === 'ADMIN_SALITA' || params.user.rol === 'RECEPCION'));

  if (!isAuthorizedRole) {
    throw new AppError(
      isReadAccess
        ? 'Acceso clínico no autorizado para este rol'
        : 'Acceso clínico restringido a profesionales con perfil vinculado',
      403
    );
  }

  if (params.user.rol === 'PROFESIONAL' && !params.user.id_persona) {
    throw new AppError(
      'Acceso clínico restringido a profesionales con perfil vinculado',
      403
    );
  }

  try {
    const scope = await verifyClinicalAccessRpc({
      idUsuario: params.user.id_usuario,
      idPaciente: params.idPaciente,
      idSalita: params.idSalita,
      permiso: params.permiso,
      fechaActo: params.fechaActo ?? null,
      idEspecialidad: params.idEspecialidad ?? null,
      requiereLongitudinal: params.requiereLongitudinal ?? false,
    });

    if (!scope || scope.autorizado !== true) {
      throw new AppError('Acceso clínico no autorizado', 403);
    }

    if (params.user.rol === 'PROFESIONAL' && !scope.id_profesional) {
      throw new AppError('Acceso clínico no autorizado', 403);
    }

    return scope;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const mapped = mapClinicalRpcError(error);
    if (mapped) {
      throw mapped;
    }

    throw error;
  }
};

/**
 * Valida el alcance de salita para consultas sobre auditoría clínica.
 * Mantiene coherencia con `consultar_auditoria_clinica`:
 * - SUPER_ADMIN: acceso global o filtrado por salita activa.
 * - PROFESIONAL / ADMIN_SALITA / RECEPCION (si poseen VER_AUDITORIA_CLINICA):
 *   exige salita vigente asignada.
 */
export const verifyClinicalAuditAccess = async (params: {
  user: AuthenticatedUser;
  idSalita?: string | null;
}): Promise<ClinicalAuditScopeContext> => {
  const { user, idSalita } = params;
  const today = agendaDateTime(new Date()).date;

  if (user.rol === 'SUPER_ADMIN') {
    if (idSalita) {
      const salita = await findActiveClinicalSalita(idSalita);
      if (!salita) {
        throw new AppError(
          'Salita inexistente o inactiva para consulta de auditoría',
          404
        );
      }
      return { id_salita: salita.id_salita, via: 'SALITA_ASIGNADA' };
    }

    return { id_salita: null, via: 'GLOBAL' };
  }

  if (user.rol === 'PROFESIONAL') {
    if (!idSalita) {
      throw new AppError(
        'Debe especificar la salita para consultar auditoría clínica',
        403
      );
    }

    if (
      !user.id_persona ||
      !(await hasActiveProfesionalSalitaScope(user.id_persona, idSalita, today))
    ) {
      throw new AppError('Salita fuera del alcance vigente del profesional', 403);
    }

    return { id_salita: idSalita, via: 'SALITA_ASIGNADA' };
  }

  if (user.rol === 'ADMIN_SALITA' || user.rol === 'RECEPCION') {
    if (!idSalita) {
      throw new AppError(
        'Debe especificar la salita para consultar auditoría clínica',
        403
      );
    }

    if (!(await hasActiveUserSalitaScope(user.id_usuario, idSalita, today))) {
      throw new AppError('Salita fuera del alcance vigente del usuario', 403);
    }

    return { id_salita: idSalita, via: 'SALITA_ASIGNADA' };
  }

  throw new AppError('Rol no habilitado para consultar auditoría clínica', 403);
};

/**
 * Valida la vigencia del profesional en la salita para operaciones sobre
 * recursos identificados por ID propio (consulta, evolución, estudio),
 * donde la RPC además valida paciente, especialidad, fecha del acto y autoría.
 */
export const verifyClinicalResourceSalitaAccess = async (params: {
  user: AuthenticatedUser;
  idSalita: string;
}): Promise<{ id_salita: string }> => {
  const today = agendaDateTime(new Date()).date;

  if (params.user.rol === 'PROFESIONAL') {
    if (!params.user.id_persona) {
      throw new AppError(
        'Acceso clínico restringido a profesionales con perfil vinculado',
        403
      );
    }

    const hasScope = await hasActiveProfesionalSalitaScope(
      params.user.id_persona,
      params.idSalita,
      today
    );

    if (!hasScope) {
      throw new AppError(
        'El profesional no tiene asociación vigente hoy con la salita indicada',
        403
      );
    }

    return { id_salita: params.idSalita };
  }

  if (params.user.rol === 'ADMIN_SALITA' || params.user.rol === 'RECEPCION') {
    const hasScope = await hasActiveUserSalitaScope(
      params.user.id_usuario,
      params.idSalita,
      today
    );

    if (!hasScope) {
      throw new AppError('Salita fuera del alcance vigente del usuario', 403);
    }

    return { id_salita: params.idSalita };
  }

  throw new AppError('Rol no habilitado para acceder al recurso clínico', 403);
};

/**
 * Valida el alcance de salita para listar o resolver derivaciones clínicas,
 * manteniendo coherencia con `listar_derivaciones_clinicas` y `resolver_derivacion_clinica`.
 */
export const verifyClinicalDerivationScope = async (params: {
  user: AuthenticatedUser;
  idSalita: string;
}): Promise<{ id_salita: string }> => {
  const { user, idSalita } = params;
  const today = agendaDateTime(new Date()).date;

  if (user.rol === 'PROFESIONAL') {
    if (
      !user.id_persona ||
      !(await hasActiveProfesionalSalitaScope(user.id_persona, idSalita, today))
    ) {
      throw new AppError('Profesional sin vigencia en la salita indicada', 403);
    }
    return { id_salita: idSalita };
  }

  if (user.rol === 'ADMIN_SALITA') {
    if (!(await hasActiveUserSalitaScope(user.id_usuario, idSalita, today))) {
      throw new AppError('Administrador sin vigencia en la salita indicada', 403);
    }
    return { id_salita: idSalita };
  }

  if (user.rol === 'SUPER_ADMIN') {
    const salita = await findActiveClinicalSalita(idSalita);
    if (!salita) {
      throw new AppError('La salita indicada no existe o está inactiva', 404);
    }
    return { id_salita: salita.id_salita };
  }

  throw new AppError('Rol no autorizado para gestionar derivaciones clínicas', 403);
};
