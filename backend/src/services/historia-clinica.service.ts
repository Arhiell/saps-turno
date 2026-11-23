import { isIP } from 'node:net';

import {
  rpcActualizarConsultaBorrador,
  rpcActualizarEstadoEstudioClinico,
  rpcAnularConsultaBorrador,
  rpcConsultarAuditoriaClinica,
  rpcConsultarConsultaMedica,
  rpcConsultarHistoriaClinica,
  rpcDescartarBorradorFormularioClinico,
  rpcFirmarConsultaMedica,
  rpcGuardarBorradorFormularioClinico,
  rpcInformarEstudioClinico,
  rpcListarDerivacionesClinicas,
  rpcObtenerBorradorFormularioClinico,
  rpcRectificarEvolucionClinica,
  rpcRegistrarConsultaClinica,
  rpcRegistrarEvolucionClinica,
  rpcResolverDerivacionClinica,
  rpcSolicitarDerivacionClinica,
} from '../repositories/historia-clinica.repository.js';
import { mapClinicalRpcError } from './clinical-scope.service.js';
import { assertRoleHasPermissions } from './permission.service.js';
import { emitirCambioAgenda, emitirCambioClinico } from './socket.service.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import type {
  ConsultaMedicaResponse,
  HistoriaClinicaResponse,
} from '../types/historia-clinica.types.js';
import { CLINICAL_PERMISSIONS } from '../types/permission.types.js';
import { AppError } from '../utils/app-error.js';
import type {
  ActualizarConsultaBorradorBody,
  ActualizarEstadoEstudioBody,
  AnularConsultaBody,
  BorradorTemporalQuery,
  ConsultarAlergiasQuery,
  ConsultarAntecedentesQuery,
  ConsultarAuditoriaClinicaQuery,
  ConsultarConsultaQuery,
  ConsultarHistoriaClinicaQuery,
  FirmarConsultaBody,
  GuardarBorradorTemporalBody,
  InformarEstudioBody,
  ListarDerivacionesQuery,
  RectificarEvolucionBody,
  RegistrarConsultaBody,
  RegistrarEvolucionBody,
  ResolverDerivacionBody,
  SolicitarDerivacionBody,
} from '../validators/historia-clinica.validator.js';

const sanitizeClientIp = (ip: string | null | undefined): string | null => {
  if (!ip) return null;
  const trimmed = ip.trim();
  if (!trimmed) return null;
  const normalized = trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
  return isIP(normalized) > 0 ? normalized : null;
};

const runClinicalRpc = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const mapped = mapClinicalRpcError(error);
    if (mapped) {
      throw mapped;
    }

    const pgErr = error as { code?: string; message?: string; details?: string; hint?: string };
    console.error('[historia-clinica-rpc-error]', JSON.stringify({
      code: pgErr?.code ?? null,
      message: pgErr?.message ?? (error instanceof Error ? error.message : null),
      details: pgErr?.details ?? null,
      hint: pgErr?.hint ?? null,
    }));
    throw new AppError('Error interno del servidor', 500);
  }
};

const normalizeAuditEndDate = (fechaHasta?: string | null): string | null => {
  if (!fechaHasta) return null;
  const trimmed = fechaHasta.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T23:59:59.999-03:00`;
  }
  return trimmed;
};

export const consultarHistoriaClinicaPaciente = async (
  user: AuthenticatedUser,
  idPaciente: string,
  query: ConsultarHistoriaClinicaQuery,
  ip: string | null
): Promise<HistoriaClinicaResponse> =>
  runClinicalRpc(() =>
    rpcConsultarHistoriaClinica({
      p_usuario: user.id_usuario,
      p_paciente: idPaciente,
      p_salita: query.id_salita,
      p_especialidad: query.id_especialidad ?? null,
      p_motivo_acceso:
        query.motivo_acceso ??
        (query.es_exportacion
          ? 'Exportación de historia clínica'
          : 'Consulta de historia clínica'),
      p_es_exportacion: query.es_exportacion,
      p_ip: sanitizeClientIp(ip),
    })
  );

export const consultarAntecedentesPaciente = async (
  user: AuthenticatedUser,
  idPaciente: string,
  query: ConsultarAntecedentesQuery,
  ip: string | null
) => {
  const historia = await runClinicalRpc(() =>
    rpcConsultarHistoriaClinica({
      p_usuario: user.id_usuario,
      p_paciente: idPaciente,
      p_salita: query.id_salita,
      p_especialidad: query.id_especialidad ?? null,
      p_motivo_acceso:
        query.motivo_acceso ?? 'Consulta de antecedentes clínicos',
      p_es_exportacion: false,
      p_ip: sanitizeClientIp(ip),
    })
  );

  const antecedentes = (historia.antecedentes ?? []).filter((item) => {
    if (query.tipo && item.tipo !== query.tipo) return false;
    if (query.estado && item.estado !== query.estado) return false;
    return true;
  });

  return {
    id_paciente: idPaciente,
    via_acceso: historia.via_acceso,
    alcance: historia.alcance,
    id_derivacion: historia.id_derivacion,
    contenido_restringido_por_alcance:
      historia.contenido_restringido_por_alcance,
    antecedentes,
  };
};

export const consultarAlergiasPaciente = async (
  user: AuthenticatedUser,
  idPaciente: string,
  query: ConsultarAlergiasQuery,
  ip: string | null
) => {
  const historia = await runClinicalRpc(() =>
    rpcConsultarHistoriaClinica({
      p_usuario: user.id_usuario,
      p_paciente: idPaciente,
      p_salita: query.id_salita,
      p_especialidad: query.id_especialidad ?? null,
      p_motivo_acceso: query.motivo_acceso ?? 'Consulta de alergias clínicas',
      p_es_exportacion: false,
      p_ip: sanitizeClientIp(ip),
    })
  );

  const alergias = (historia.alergias ?? []).filter((item) => {
    if (query.estado && item.estado !== query.estado) return false;
    return true;
  });

  return {
    id_paciente: idPaciente,
    via_acceso: historia.via_acceso,
    alcance: historia.alcance,
    id_derivacion: historia.id_derivacion,
    contenido_restringido_por_alcance:
      historia.contenido_restringido_por_alcance,
    alergias,
  };
};

export const consultarConsultaMedicaPorId = async (
  user: AuthenticatedUser,
  idConsulta: string,
  query: ConsultarConsultaQuery,
  ip: string | null
): Promise<ConsultaMedicaResponse> =>
  runClinicalRpc(() =>
    rpcConsultarConsultaMedica({
      p_usuario: user.id_usuario,
      p_consulta: idConsulta,
      p_salita: query.id_salita,
      p_paciente: query.id_paciente ?? null,
      p_motivo_acceso: query.motivo_acceso ?? 'Consulta de detalle médico',
      p_ip: sanitizeClientIp(ip),
    })
  );

const assertClinicalPayloadPermissions = async (
  user: AuthenticatedUser,
  body: {
    diagnosticos?: unknown[] | undefined;
    evoluciones?: unknown[] | undefined;
    tratamientos?: unknown[] | undefined;
    estudios?: unknown[] | undefined;
    antecedentes?: unknown[] | undefined;
    alergias?: unknown[] | undefined;
  }
) => {
  const extraPermissions: string[] = [];

  if (body.diagnosticos && body.diagnosticos.length > 0) {
    extraPermissions.push(CLINICAL_PERMISSIONS.REGISTRAR_DIAGNOSTICOS);
  }
  if (body.evoluciones && body.evoluciones.length > 0) {
    extraPermissions.push(CLINICAL_PERMISSIONS.REGISTRAR_EVOLUCIONES);
  }
  if (body.tratamientos && body.tratamientos.length > 0) {
    extraPermissions.push(CLINICAL_PERMISSIONS.GESTIONAR_TRATAMIENTOS);
  }
  if (body.estudios && body.estudios.length > 0) {
    extraPermissions.push(CLINICAL_PERMISSIONS.GESTIONAR_ESTUDIOS_CLINICOS);
  }
  if (
    (body.antecedentes && body.antecedentes.length > 0) ||
    (body.alergias && body.alergias.length > 0)
  ) {
    extraPermissions.push(CLINICAL_PERMISSIONS.GESTIONAR_ANTECEDENTES_CLINICOS);
  }

  if (extraPermissions.length > 0) {
    await assertRoleHasPermissions(
      {
        ...(user.id_rol ? { idRol: user.id_rol } : {}),
        codigo: user.rol,
      },
      extraPermissions
    );
  }
};

const verifySignedResultAndNotifyAgenda = (
  result: Record<string, unknown>,
  expectedSigned: boolean,
  idSalita: string
) => {
  if (expectedSigned && result?.estado !== 'FIRMADA') {
    throw new AppError(
      'No se pudo completar la firma definitiva de la consulta médica; el registro no cambió silenciosamente a borrador.',
      409
    );
  }

  if (
    result?.turno_actualizado === true &&
    typeof result.id_turno === 'string' &&
    typeof result.id_profesional === 'string'
  ) {
    try {
      emitirCambioAgenda({
        tipo: 'TURNO_ACTUALIZADO',
        mensaje: 'Un turno de tu agenda pasó a estado Atendido al firmar la consulta médica',
        id_turno: result.id_turno,
        id_profesional: result.id_profesional,
        id_salita: idSalita,
        estado: 'ATENDIDO',
      });
    } catch {
      // Notificación de agenda en tiempo real es complementaria al commit en BD.
    }
  }

  if (result?.estado === 'FIRMADA' && typeof result.id_paciente === 'string') {
    try {
      emitirCambioClinico({
        tipo: 'CONSULTA_FIRMADA',
        mensaje: 'Consulta médica firmada',
        id_paciente: result.id_paciente,
        id_salita: idSalita,
        id_consulta: typeof result.id_consulta === 'string' ? result.id_consulta : undefined,
        id_profesional: typeof result.id_profesional === 'string' ? result.id_profesional : undefined,
      });
    } catch {
      // Notificación clínica en tiempo real es complementaria
    }
  }
};

export const registrarConsultaClinica = async (
  user: AuthenticatedUser,
  body: RegistrarConsultaBody,
  ip: string | null
) => {
  await assertClinicalPayloadPermissions(user, body);

  const payload: Record<string, unknown> = {
    id_paciente: body.id_paciente,
    id_especialidad: body.id_especialidad,
    motivo_consulta: body.motivo_consulta,
    firmar: body.firmar,
    ...(body.id_turno !== undefined ? { id_turno: body.id_turno } : {}),
    ...(body.acompanante_tutor_id !== undefined
      ? { acompanante_tutor_id: body.acompanante_tutor_id }
      : {}),
    ...(body.fecha_atencion ? { fecha_atencion: body.fecha_atencion } : {}),
    ...(body.fecha_preparacion
      ? { fecha_preparacion: body.fecha_preparacion }
      : !body.firmar
        ? { fecha_preparacion: new Date().toISOString() }
        : {}),
    ...(body.sintomas !== undefined ? { sintomas: body.sintomas } : {}),
    ...(body.examen_fisico !== undefined
      ? { examen_fisico: body.examen_fisico }
      : {}),
    ...(body.observaciones !== undefined
      ? { observaciones: body.observaciones }
      : {}),
    ...(body.motivo_acceso ? { motivo_acceso: body.motivo_acceso } : {}),
    ...(body.diagnosticos ? { diagnosticos: body.diagnosticos } : {}),
    ...(body.evoluciones ? { evoluciones: body.evoluciones } : {}),
    ...(body.tratamientos ? { tratamientos: body.tratamientos } : {}),
    ...(body.estudios ? { estudios: body.estudios } : {}),
    ...(body.antecedentes ? { antecedentes: body.antecedentes } : {}),
    ...(body.alergias ? { alergias: body.alergias } : {}),
  };

  const result = await runClinicalRpc(() =>
    rpcRegistrarConsultaClinica({
      p_usuario: user.id_usuario,
      p_salita: body.id_salita,
      p_datos: payload,
      p_ip: sanitizeClientIp(ip),
    })
  );

  verifySignedResultAndNotifyAgenda(result, body.firmar, body.id_salita);
  return result;
};

export const actualizarConsultaBorrador = async (
  user: AuthenticatedUser,
  idConsulta: string,
  body: ActualizarConsultaBorradorBody,
  ip: string | null
) => {
  await assertClinicalPayloadPermissions(user, body);

  const payload: Record<string, unknown> = {
    motivo_consulta: body.motivo_consulta,
    firmar: body.firmar,
    ...(body.id_especialidad ? { id_especialidad: body.id_especialidad } : {}),
    ...(body.acompanante_tutor_id !== undefined
      ? { acompanante_tutor_id: body.acompanante_tutor_id }
      : {}),
    ...(body.fecha_atencion ? { fecha_atencion: body.fecha_atencion } : {}),
    ...(body.fecha_preparacion
      ? { fecha_preparacion: body.fecha_preparacion }
      : {}),
    ...(body.sintomas !== undefined ? { sintomas: body.sintomas } : {}),
    ...(body.examen_fisico !== undefined
      ? { examen_fisico: body.examen_fisico }
      : {}),
    ...(body.observaciones !== undefined
      ? { observaciones: body.observaciones }
      : {}),
    ...(body.motivo_acceso ? { motivo_acceso: body.motivo_acceso } : {}),
    ...(body.diagnosticos !== undefined
      ? { diagnosticos: body.diagnosticos }
      : {}),
    ...(body.evoluciones !== undefined
      ? { evoluciones: body.evoluciones }
      : {}),
    ...(body.tratamientos !== undefined
      ? { tratamientos: body.tratamientos }
      : {}),
    ...(body.estudios !== undefined ? { estudios: body.estudios } : {}),
  };

  const result = await runClinicalRpc(() =>
    rpcActualizarConsultaBorrador({
      p_usuario: user.id_usuario,
      p_salita: body.id_salita,
      p_id_consulta: idConsulta,
      p_datos: payload,
      p_ip: sanitizeClientIp(ip),
    })
  );

  verifySignedResultAndNotifyAgenda(result, body.firmar, body.id_salita);
  return result;
};

export const firmarConsultaMedica = async (
  user: AuthenticatedUser,
  idConsulta: string,
  body: FirmarConsultaBody,
  ip: string | null
) => {
  const result = await runClinicalRpc(() =>
    rpcFirmarConsultaMedica({
      p_usuario: user.id_usuario,
      p_salita: body.id_salita,
      p_id_consulta: idConsulta,
      p_paciente: body.id_paciente ?? null,
      p_motivo_acceso: body.motivo_acceso ?? 'Firma de consulta médica',
      p_ip: sanitizeClientIp(ip),
    })
  );

  verifySignedResultAndNotifyAgenda(result, true, body.id_salita);
  return result;
};

export const anularConsultaBorrador = async (
  user: AuthenticatedUser,
  idConsulta: string,
  body: AnularConsultaBody,
  ip: string | null
) =>
  runClinicalRpc(() =>
    rpcAnularConsultaBorrador({
      p_usuario: user.id_usuario,
      p_salita: body.id_salita,
      p_id_consulta: idConsulta,
      p_motivo_anulacion: body.motivo_anulacion,
      p_paciente: body.id_paciente ?? null,
      p_ip: sanitizeClientIp(ip),
    })
  );

export const registrarEvolucionClinica = async (
  user: AuthenticatedUser,
  idConsulta: string,
  body: RegistrarEvolucionBody,
  ip: string | null
) => {
  const result = await runClinicalRpc(() =>
    rpcRegistrarEvolucionClinica({
      p_usuario: user.id_usuario,
      p_salita: body.id_salita,
      p_id_consulta: idConsulta,
      p_evolucion: body.evolucion,
      p_observaciones: body.observaciones ?? null,
      p_paciente: body.id_paciente ?? null,
      p_motivo_acceso: body.motivo_acceso ?? 'Registro de evolución clínica',
      p_ip: sanitizeClientIp(ip),
    })
  );

  if (body.id_paciente) {
    try {
      emitirCambioClinico({
        tipo: 'EVOLUCION_REGISTRADA',
        mensaje: 'Nueva evolución clínica registrada',
        id_paciente: body.id_paciente,
        id_salita: body.id_salita,
        id_consulta: idConsulta,
      });
    } catch {
      // Notificación en tiempo real es complementaria
    }
  }

  return result;
};

export const rectificarEvolucionClinica = async (
  user: AuthenticatedUser,
  idEvolucion: string,
  body: RectificarEvolucionBody,
  ip: string | null
) =>
  runClinicalRpc(() =>
    rpcRectificarEvolucionClinica({
      p_usuario: user.id_usuario,
      p_salita: body.id_salita,
      p_id_evolucion: idEvolucion,
      p_nueva_evolucion: body.nueva_evolucion,
      p_observaciones: body.observaciones ?? null,
      p_motivo_correccion: body.motivo_correccion,
      p_paciente: body.id_paciente ?? null,
      p_ip: sanitizeClientIp(ip),
    })
  );

export const actualizarEstadoEstudioClinico = async (
  user: AuthenticatedUser,
  idEstudio: string,
  body: ActualizarEstadoEstudioBody,
  ip: string | null
) =>
  runClinicalRpc(() =>
    rpcActualizarEstadoEstudioClinico({
      p_usuario: user.id_usuario,
      p_salita: body.id_salita,
      p_id_estudio: idEstudio,
      p_nuevo_estado: body.nuevo_estado,
      p_motivo: body.motivo ?? 'Actualización de estado de estudio clínico',
      p_paciente: body.id_paciente ?? null,
      p_ip: sanitizeClientIp(ip),
    })
  );

export const informarEstudioClinico = async (
  user: AuthenticatedUser,
  idEstudio: string,
  body: InformarEstudioBody,
  ip: string | null
) => {
  const result = await runClinicalRpc(() =>
    rpcInformarEstudioClinico({
      p_usuario: user.id_usuario,
      p_salita: body.id_salita,
      p_id_estudio: idEstudio,
      p_resultado: body.resultado,
      p_paciente: body.id_paciente ?? null,
      p_motivo_acceso:
        body.motivo_acceso ?? 'Informe de resultado de estudio clínico',
      p_ip: sanitizeClientIp(ip),
    })
  );

  if (body.id_paciente) {
    try {
      emitirCambioClinico({
        tipo: 'ESTUDIO_INFORMADO',
        mensaje: 'Estudio clínico informado',
        id_paciente: body.id_paciente,
        id_salita: body.id_salita,
      });
    } catch {
      // Notificación en tiempo real es complementaria
    }
  }

  return result;
};

export const listarDerivacionesClinicas = async (
  user: AuthenticatedUser,
  query: ListarDerivacionesQuery
) =>
  runClinicalRpc(() =>
    rpcListarDerivacionesClinicas({
      p_usuario: user.id_usuario,
      p_salita: query.id_salita,
      p_paciente: query.id_paciente ?? null,
      p_estado: query.estado ?? null,
    })
  );

export const solicitarDerivacionClinica = async (
  user: AuthenticatedUser,
  body: SolicitarDerivacionBody,
  ip: string | null
) => {
  const result = await runClinicalRpc(() =>
    rpcSolicitarDerivacionClinica({
      p_usuario: user.id_usuario,
      p_salita: body.id_salita,
      p_datos: {
        id_paciente: body.id_paciente,
        id_salita_destino: body.id_salita_destino,
        tipo: body.tipo,
        ...(body.alcance ? { alcance: body.alcance } : {}),
        ...(body.id_profesional_destino !== undefined
          ? { id_profesional_destino: body.id_profesional_destino }
          : {}),
        ...(body.id_especialidad_destino !== undefined
          ? { id_especialidad_destino: body.id_especialidad_destino }
          : {}),
        motivo: body.motivo,
        ...(body.fecha_desde ? { fecha_desde: body.fecha_desde } : {}),
        fecha_hasta: body.fecha_hasta,
      },
      p_ip: sanitizeClientIp(ip),
    })
  );

  try {
    emitirCambioClinico({
      tipo: 'DERIVACION_ACTUALIZADA',
      mensaje: 'Nueva solicitud de derivación clínica',
      id_paciente: body.id_paciente,
      id_salita: body.id_salita,
      id_derivacion: (result as any)?.id_derivacion,
    });
  } catch {
    // Notificación en tiempo real es complementaria
  }

  return result;
};

export const resolverDerivacionClinica = async (
  user: AuthenticatedUser,
  idDerivacion: string,
  body: ResolverDerivacionBody,
  ip: string | null
) => {
  const result = await runClinicalRpc(() =>
    rpcResolverDerivacionClinica({
      p_usuario: user.id_usuario,
      p_salita: body.id_salita,
      p_id_derivacion: idDerivacion,
      p_nuevo_estado: body.nuevo_estado,
      p_motivo: body.motivo ?? null,
      p_ip: sanitizeClientIp(ip),
    })
  );

  try {
    emitirCambioClinico({
      tipo: 'DERIVACION_ACTUALIZADA',
      mensaje: `Derivación ${body.nuevo_estado.toLowerCase()}`,
      id_paciente: (result as any)?.id_paciente || 'derivacion',
      id_salita: body.id_salita,
      id_derivacion: idDerivacion,
    });
  } catch {
    // Notificación en tiempo real es complementaria
  }

  return result;
};

export const consultarAuditoriaClinica = async (
  user: AuthenticatedUser,
  query: ConsultarAuditoriaClinicaQuery,
  ip: string | null
) =>
  runClinicalRpc(() =>
    rpcConsultarAuditoriaClinica({
      p_usuario: user.id_usuario,
      p_salita: query.id_salita ?? null,
      p_paciente: query.id_paciente ?? null,
      p_fecha_desde: query.fecha_desde ?? null,
      p_fecha_hasta: normalizeAuditEndDate(query.fecha_hasta),
      p_limit: query.limit,
      p_offset: query.offset,
      p_ip: sanitizeClientIp(ip),
    })
  );

const isMissingDraftRpcError = (error: unknown): boolean => {
  const pgError = error as { code?: string; message?: string } | null;
  if (!pgError) return false;
  if (pgError.code === 'PGRST202' || pgError.code === '42883') {
    return true;
  }
  return Boolean(
    pgError.message &&
      /Could not find the function|function public\..*borrador.* does not exist/i.test(
        pgError.message
      )
  );
};

export const obtenerBorradorTemporal = async (
  user: AuthenticatedUser,
  query: BorradorTemporalQuery
): Promise<{ available: boolean; borrador: Record<string, unknown> | null }> => {
  try {
    const borrador = await rpcObtenerBorradorFormularioClinico({
      p_usuario: user.id_usuario,
      p_paciente: query.id_paciente,
      p_salita: query.id_salita,
      p_turno: query.id_turno ?? null,
    });
    return {
      available: true,
      borrador: borrador ?? null,
    };
  } catch (error) {
    if (isMissingDraftRpcError(error)) {
      return { available: false, borrador: null };
    }
    const mapped = mapClinicalRpcError(error);
    if (mapped) {
      throw mapped;
    }
    console.error('[historia-clinica:borrador:get]', error);
    throw new AppError('Error interno del servidor', 500);
  }
};

export const guardarBorradorTemporal = async (
  user: AuthenticatedUser,
  body: GuardarBorradorTemporalBody
): Promise<{ available: boolean; borrador: Record<string, unknown> | null }> => {
  try {
    const borrador = await rpcGuardarBorradorFormularioClinico({
      p_usuario: user.id_usuario,
      p_paciente: body.id_paciente,
      p_salita: body.id_salita,
      p_especialidad: body.id_especialidad ?? null,
      p_turno: body.id_turno ?? null,
      p_datos_formulario: body.datos_formulario,
      p_version_esperada: body.version_esperada ?? null,
    });
    return {
      available: true,
      borrador,
    };
  } catch (error) {
    if (isMissingDraftRpcError(error)) {
      return { available: false, borrador: null };
    }
    const mapped = mapClinicalRpcError(error);
    if (mapped) {
      if (mapped.statusCode === 409) {
        const latest = await obtenerBorradorTemporal(user, {
          id_paciente: body.id_paciente,
          id_salita: body.id_salita,
          ...(body.id_turno ? { id_turno: body.id_turno } : {}),
        }).catch(() => ({ available: false, borrador: null }));
        throw new AppError(
          mapped.message,
          409,
          'BORRADOR_CONFLICT',
          latest.borrador ? { borrador_actual: latest.borrador } : undefined
        );
      }
      throw mapped;
    }
    console.error('[historia-clinica:borrador:put]', error);
    throw new AppError('Error interno del servidor', 500);
  }
};

export const descartarBorradorTemporal = async (
  user: AuthenticatedUser,
  query: BorradorTemporalQuery
): Promise<{ available: boolean; descartado: boolean }> => {
  try {
    const result = await rpcDescartarBorradorFormularioClinico({
      p_usuario: user.id_usuario,
      p_paciente: query.id_paciente,
      p_salita: query.id_salita,
      p_turno: query.id_turno ?? null,
    });
    return {
      available: true,
      descartado: Boolean(result?.descartado),
    };
  } catch (error) {
    if (isMissingDraftRpcError(error)) {
      return { available: false, descartado: false };
    }
    const mapped = mapClinicalRpcError(error);
    if (mapped) {
      throw mapped;
    }
    console.error('[historia-clinica:borrador:delete]', error);
    throw new AppError('Error interno del servidor', 500);
  }
};
