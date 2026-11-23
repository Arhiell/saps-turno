import { supabase } from '../config/supabase.js';
import type {
  ConsultaMedicaResponse,
  HistoriaClinicaResponse,
} from '../types/historia-clinica.types.js';

const invokeClinicalRpc = async <T>(
  fnName: string,
  params: Record<string, unknown>
): Promise<T> => {
  const { data, error } = await supabase.rpc(fnName, params);

  if (error) {
    throw error;
  }

  return data as T;
};

export const rpcConsultarHistoriaClinica = (params: {
  p_usuario: string;
  p_paciente: string;
  p_salita: string;
  p_especialidad?: string | null;
  p_motivo_acceso?: string;
  p_es_exportacion?: boolean;
  p_ip?: string | null;
}) =>
  invokeClinicalRpc<HistoriaClinicaResponse>('consultar_historia_clinica', {
    p_usuario: params.p_usuario,
    p_paciente: params.p_paciente,
    p_salita: params.p_salita,
    p_especialidad: params.p_especialidad ?? null,
    p_motivo_acceso: params.p_motivo_acceso ?? 'Consulta de historia clínica',
    p_es_exportacion: params.p_es_exportacion ?? false,
    p_ip: params.p_ip ?? null,
  });

export const rpcConsultarConsultaMedica = (params: {
  p_usuario: string;
  p_consulta: string;
  p_salita: string;
  p_paciente?: string | null;
  p_motivo_acceso?: string;
  p_ip?: string | null;
}) =>
  invokeClinicalRpc<ConsultaMedicaResponse>('consultar_consulta_medica', {
    p_usuario: params.p_usuario,
    p_consulta: params.p_consulta,
    p_salita: params.p_salita,
    p_paciente: params.p_paciente ?? null,
    p_motivo_acceso: params.p_motivo_acceso ?? 'Consulta de detalle médico',
    p_ip: params.p_ip ?? null,
  });

export const rpcRegistrarConsultaClinica = (params: {
  p_usuario: string;
  p_salita: string;
  p_datos: Record<string, unknown>;
  p_ip?: string | null;
}) =>
  invokeClinicalRpc<Record<string, unknown>>('registrar_consulta_clinica', {
    p_usuario: params.p_usuario,
    p_salita: params.p_salita,
    p_datos: params.p_datos,
    p_ip: params.p_ip ?? null,
  });

export const rpcActualizarConsultaBorrador = (params: {
  p_usuario: string;
  p_salita: string;
  p_id_consulta: string;
  p_datos: Record<string, unknown>;
  p_ip?: string | null;
}) =>
  invokeClinicalRpc<Record<string, unknown>>('actualizar_consulta_borrador', {
    p_usuario: params.p_usuario,
    p_salita: params.p_salita,
    p_id_consulta: params.p_id_consulta,
    p_datos: params.p_datos,
    p_ip: params.p_ip ?? null,
  });

export const rpcFirmarConsultaMedica = (params: {
  p_usuario: string;
  p_salita: string;
  p_id_consulta: string;
  p_paciente?: string | null;
  p_motivo_acceso?: string;
  p_ip?: string | null;
}) =>
  invokeClinicalRpc<Record<string, unknown>>('firmar_consulta_medica', {
    p_usuario: params.p_usuario,
    p_salita: params.p_salita,
    p_id_consulta: params.p_id_consulta,
    p_paciente: params.p_paciente ?? null,
    p_motivo_acceso: params.p_motivo_acceso ?? 'Firma de consulta médica',
    p_ip: params.p_ip ?? null,
  });

export const rpcAnularConsultaBorrador = (params: {
  p_usuario: string;
  p_salita: string;
  p_id_consulta: string;
  p_motivo_anulacion: string;
  p_paciente?: string | null;
  p_ip?: string | null;
}) =>
  invokeClinicalRpc<Record<string, unknown>>('anular_consulta_borrador', {
    p_usuario: params.p_usuario,
    p_salita: params.p_salita,
    p_id_consulta: params.p_id_consulta,
    p_motivo_anulacion: params.p_motivo_anulacion,
    p_paciente: params.p_paciente ?? null,
    p_ip: params.p_ip ?? null,
  });

export const rpcRegistrarEvolucionClinica = (params: {
  p_usuario: string;
  p_salita: string;
  p_id_consulta: string;
  p_evolucion: string;
  p_observaciones?: string | null;
  p_paciente?: string | null;
  p_motivo_acceso?: string;
  p_ip?: string | null;
}) =>
  invokeClinicalRpc<Record<string, unknown>>('registrar_evolucion_clinica', {
    p_usuario: params.p_usuario,
    p_salita: params.p_salita,
    p_id_consulta: params.p_id_consulta,
    p_evolucion: params.p_evolucion,
    p_observaciones: params.p_observaciones ?? null,
    p_paciente: params.p_paciente ?? null,
    p_motivo_acceso: params.p_motivo_acceso ?? 'Registro de evolución clínica',
    p_ip: params.p_ip ?? null,
  });

export const rpcRectificarEvolucionClinica = (params: {
  p_usuario: string;
  p_salita: string;
  p_id_evolucion: string;
  p_nueva_evolucion: string;
  p_observaciones?: string | null;
  p_motivo_correccion: string;
  p_paciente?: string | null;
  p_ip?: string | null;
}) =>
  invokeClinicalRpc<Record<string, unknown>>('rectificar_evolucion_clinica', {
    p_usuario: params.p_usuario,
    p_salita: params.p_salita,
    p_id_evolucion: params.p_id_evolucion,
    p_nueva_evolucion: params.p_nueva_evolucion,
    p_observaciones: params.p_observaciones ?? null,
    p_motivo_correccion: params.p_motivo_correccion,
    p_paciente: params.p_paciente ?? null,
    p_ip: params.p_ip ?? null,
  });

export const rpcActualizarEstadoEstudioClinico = (params: {
  p_usuario: string;
  p_salita: string;
  p_id_estudio: string;
  p_nuevo_estado: 'EN_PROCESO' | 'CANCELADO';
  p_motivo?: string;
  p_paciente?: string | null;
  p_ip?: string | null;
}) =>
  invokeClinicalRpc<Record<string, unknown>>(
    'actualizar_estado_estudio_clinico',
    {
      p_usuario: params.p_usuario,
      p_salita: params.p_salita,
      p_id_estudio: params.p_id_estudio,
      p_nuevo_estado: params.p_nuevo_estado,
      p_motivo:
        params.p_motivo ?? 'Actualización de estado de estudio clínico',
      p_paciente: params.p_paciente ?? null,
      p_ip: params.p_ip ?? null,
    }
  );

export const rpcInformarEstudioClinico = (params: {
  p_usuario: string;
  p_salita: string;
  p_id_estudio: string;
  p_resultado: string;
  p_paciente?: string | null;
  p_motivo_acceso?: string;
  p_ip?: string | null;
}) =>
  invokeClinicalRpc<Record<string, unknown>>('informar_estudio_clinico', {
    p_usuario: params.p_usuario,
    p_salita: params.p_salita,
    p_id_estudio: params.p_id_estudio,
    p_resultado: params.p_resultado,
    p_paciente: params.p_paciente ?? null,
    p_motivo_acceso:
      params.p_motivo_acceso ?? 'Informe de resultado de estudio clínico',
    p_ip: params.p_ip ?? null,
  });

export const rpcSolicitarDerivacionClinica = (params: {
  p_usuario: string;
  p_salita: string;
  p_datos: Record<string, unknown>;
  p_ip?: string | null;
}) =>
  invokeClinicalRpc<Record<string, unknown>>('solicitar_derivacion_clinica', {
    p_usuario: params.p_usuario,
    p_salita: params.p_salita,
    p_datos: params.p_datos,
    p_ip: params.p_ip ?? null,
  });

export const rpcResolverDerivacionClinica = (params: {
  p_usuario: string;
  p_salita: string;
  p_id_derivacion: string;
  p_nuevo_estado: 'AUTORIZADA' | 'RECHAZADA' | 'REVOCADA';
  p_motivo?: string | null;
  p_ip?: string | null;
}) =>
  invokeClinicalRpc<Record<string, unknown>>('resolver_derivacion_clinica', {
    p_usuario: params.p_usuario,
    p_salita: params.p_salita,
    p_id_derivacion: params.p_id_derivacion,
    p_nuevo_estado: params.p_nuevo_estado,
    p_motivo: params.p_motivo ?? null,
    p_ip: params.p_ip ?? null,
  });

export const rpcListarDerivacionesClinicas = (params: {
  p_usuario: string;
  p_salita: string;
  p_paciente?: string | null;
  p_estado?: string | null;
}) =>
  invokeClinicalRpc<Array<Record<string, unknown>>>(
    'listar_derivaciones_clinicas',
    {
      p_usuario: params.p_usuario,
      p_salita: params.p_salita,
      p_paciente: params.p_paciente ?? null,
      p_estado: params.p_estado ?? null,
    }
  );

export const rpcConsultarAuditoriaClinica = (params: {
  p_usuario: string;
  p_salita?: string | null;
  p_paciente?: string | null;
  p_fecha_desde?: string | null;
  p_fecha_hasta?: string | null;
  p_limit?: number;
  p_offset?: number;
  p_ip?: string | null;
}) =>
  invokeClinicalRpc<Array<Record<string, unknown>>>(
    'consultar_auditoria_clinica',
    {
      p_usuario: params.p_usuario,
      p_salita: params.p_salita ?? null,
      p_paciente: params.p_paciente ?? null,
      p_fecha_desde: params.p_fecha_desde ?? null,
      p_fecha_hasta: params.p_fecha_hasta ?? null,
      p_limit: params.p_limit ?? 50,
      p_offset: params.p_offset ?? 0,
      p_ip: params.p_ip ?? null,
    }
  );

export const rpcObtenerBorradorFormularioClinico = (params: {
  p_usuario: string;
  p_paciente: string;
  p_salita: string;
  p_turno?: string | null;
}) =>
  invokeClinicalRpc<Record<string, unknown> | null>(
    'obtener_borrador_formulario_clinico',
    {
      p_usuario: params.p_usuario,
      p_paciente: params.p_paciente,
      p_salita: params.p_salita,
      p_turno: params.p_turno ?? null,
    }
  );

export const rpcGuardarBorradorFormularioClinico = (params: {
  p_usuario: string;
  p_paciente: string;
  p_salita: string;
  p_especialidad?: string | null;
  p_turno?: string | null;
  p_datos_formulario: Record<string, unknown>;
  p_version_esperada?: number | null;
}) =>
  invokeClinicalRpc<Record<string, unknown>>(
    'guardar_borrador_formulario_clinico',
    {
      p_usuario: params.p_usuario,
      p_paciente: params.p_paciente,
      p_salita: params.p_salita,
      p_especialidad: params.p_especialidad ?? null,
      p_turno: params.p_turno ?? null,
      p_datos_formulario: params.p_datos_formulario,
      p_version_esperada: params.p_version_esperada ?? null,
    }
  );

export const rpcDescartarBorradorFormularioClinico = (params: {
  p_usuario: string;
  p_paciente: string;
  p_salita: string;
  p_turno?: string | null;
}) =>
  invokeClinicalRpc<Record<string, unknown>>(
    'descartar_borrador_formulario_clinico',
    {
      p_usuario: params.p_usuario,
      p_paciente: params.p_paciente,
      p_salita: params.p_salita,
      p_turno: params.p_turno ?? null,
    }
  );
