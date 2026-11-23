import { supabase } from '../config/supabase.js';

import {
  AppError,
} from '../utils/app-error.js';

import type {
  Audiencia,
} from '../validators/notificacion-admin.validator.js';

// Representa un usuario destinatario de una notificación.
export interface Destinatario {
  id_usuario: string;
  nombre: string;
  email: string;
  rol: string;
}

// Representa la vista previa de una audiencia.
export interface Preview {
  cantidad: number;
  confirmacion: string;
  usuarios: Destinatario[];
}

// Representa el resumen de un envío de notificaciones.
export interface Envio {
  id_envio: string;
  id_remitente: string;
  id_salita: string | null;
  remitente: string;
  rol_remitente: string;
  audiencia: Audiencia;
  destinatarios: string;
  titulo: string;
  mensaje: string;
  cantidad: number;
  email: boolean;
  fecha_creacion: string;
  fecha_programada: string | null;
  fecha_envio: string | null;
  estado: string;
  sistema_enviadas: number;
  email_enviados: number;
  pendientes: number;
  fallidas: number;
  canceladas: number;
}

// Obtiene una vista previa de los destinatarios de una audiencia.
export const previewAudiencia = async (
  audiencia: Audiencia,
  excluir: boolean,
  buscar?: string,
  excluirUsuario?: string
): Promise<Preview> => {
  const {
    data,
    error,
  } = await supabase.rpc(
    'notificacion_preview_v2',
    {
      a: audiencia,
      excluir_super: excluir,
      buscar: buscar ?? null,
      excluir_usuario:
        excluirUsuario ?? null,
    }
  );

  if (error) {
    throw error;
  }

  return data as Preview;
};

// Crea un nuevo envío de notificaciones.
export const insertarEnvio = async (
  datos: Record<string, unknown>,
  excluir: boolean,
  confirmacion: string
): Promise<string> => {
  const {
    data,
    error,
  } = await supabase.rpc(
    'notificacion_crear_envio',
    {
      datos,
      excluir_super: excluir,
      confirmacion,
    }
  );

  // Detecta cambios en la audiencia antes de confirmar el envío.
  if (
    error?.message ===
    'AUDIENCIA_CAMBIO'
  ) {
    throw new AppError(
      'Los destinatarios cambiaron. Revisá y confirmá nuevamente el envío.',
      409
    );
  }

  if (
    error?.message ===
    'FECHA_PASADA'
  ) {
    throw new AppError(
      'La fecha programada debe ser futura.',
      400
    );
  }

  if (error) {
    throw error;
  }

  return data as string;
};

// Obtiene el historial paginado de envíos.
export const consultarEnvios = async (
  scope: string[] | null,
  page: number,
  limit: number,
  programadas: boolean
) => {
  let query =
    supabase
      .from(
        'notificacion_envios_resumen'
      )
      .select(
        '*',
        {
          count: 'exact',
        }
      );

  // Limita los resultados a las salitas permitidas.
  if (scope !== null) {
    query = query.in(
      'id_salita',
      scope
    );
  }

  // Filtra únicamente las notificaciones programadas pendientes.
  if (programadas) {
    query = query
      .eq(
        'estado',
        'PENDIENTE'
      )
      .not(
        'fecha_programada',
        'is',
        null
      );
  }

  const {
    data,
    error,
    count,
  } = await query
    .order(
      programadas
        ? 'fecha_programada'
        : 'fecha_creacion',
      {
        ascending:
          programadas,
      }
    )
    .order('id_envio')
    .range(
      (page - 1) * limit,
      page * limit - 1
    );

  if (error) {
    throw error;
  }

  return {
    envios:
      (data ?? []) as Envio[],
    total: count ?? 0,
    totalPages:
      Math.ceil(
        (count ?? 0) / limit
      ),
    page,
  };
};

// Obtiene un envío por su identificador.
export const consultarEnvio =
  async (
    id: string
  ): Promise<Envio | null> => {
    const {
      data,
      error,
    } = await supabase
      .from(
        'notificacion_envios_resumen'
      )
      .select('*')
      .eq(
        'id_envio',
        id
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as Envio | null;
  };

// Obtiene los datos principales de un envío.
export const consultarCabeceraEnvio =
  async (
    id: string
  ) => {
    const {
      data,
      error,
    } = await supabase
      .from(
        'notificacion_envios'
      )
      .select(
        'id_remitente,rol_remitente,audiencia'
      )
      .eq(
        'id_envio',
        id
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as
      | Pick<
          Envio,
          | 'id_remitente'
          | 'rol_remitente'
          | 'audiencia'
        >
      | null;
  };

// Obtiene un resumen de los motivos de fallas y cancelaciones.
export const resumenFallas =
  async (
    id: string
  ): Promise<
    {
      motivo: string;
      cantidad: number;
    }[]
  > => {
    const {
      data,
      error,
    } = await supabase.rpc(
      'notificacion_resumen_fallas',
      {
        envio: id,
      }
    );

    if (!error) {
      return data;
    }

    if (
      error.code !==
      'PGRST202'
    ) {
      throw error;
    }

    // Mantiene compatibilidad si la función todavía no está disponible en PostgREST.
    const resumen =
      new Map<string, number>();

    for (
      let offset = 0;
      ;
      offset += 500
    ) {
      const result =
        await supabase
          .from(
            'notificaciones'
          )
          .select(
            'error_envio'
          )
          .eq(
            'id_envio',
            id
          )
          .in(
            'estado_envio',
            [
              'FALLIDA',
              'CANCELADA',
            ]
          )
          .order(
            'id_notificacion'
          )
          .range(
            offset,
            offset + 499
          );

      if (result.error) {
        throw result.error;
      }

      for (
        const row
        of result.data ?? []
      ) {
        const motivo =
          row.error_envio ??
          'Entrega cancelada por la administración.';

        resumen.set(
          motivo,
          (
            resumen.get(
              motivo
            ) ?? 0
          ) + 1
        );
      }

      if (
        !result.data ||
        result.data.length <
          500
      ) {
        break;
      }
    }

    return [
      ...resumen,
    ].map(
      ([
        motivo,
        cantidad,
      ]) => ({
        motivo,
        cantidad,
      })
    );
  };

// Modifica un envío que todavía se encuentra programado.
export const modificarEnvio =
  async (
    id: string,
    datos:
      Record<string, unknown>,
    original:
      Record<string, unknown>,
    excluir: boolean
  ) => {
    const {
      error,
    } = await supabase.rpc(
      'notificacion_editar_envio',
      {
        envio: id,
        datos,
        original,
        excluir_super:
          excluir,
      }
    );

    if (
      error?.code ===
      'PGRST202'
    ) {
      throw new AppError(
        'Falta aplicar la actualización de base de datos para editar programaciones.',
        503
      );
    }

    if (
      error?.message ===
      'ENVIO_NO_EDITABLE'
    ) {
      throw new AppError(
        'La notificación ya comenzó a enviarse o fue cancelada. No se puede editar.',
        409
      );
    }

    if (
      error?.message ===
      'ENVIO_MODIFICADO'
    ) {
      throw new AppError(
        'Otra persona modificó esta programación. Recargá la página antes de editar.',
        409
      );
    }

    if (
      error?.message ===
      'AUDIENCIA_CAMBIO'
    ) {
      throw new AppError(
        'Los destinatarios cambiaron. Revisá y confirmá nuevamente.',
        409
      );
    }

    if (
      error?.message ===
      'FECHA_PASADA'
    ) {
      throw new AppError(
        'La fecha programada debe ser futura.',
        400
      );
    }

    if (error) {
      throw error;
    }
  };

// Cancela un envío programado.
export const cancelarEnvio =
  async (
    id: string,
    actor: string
  ) => {
    const {
      data,
      error,
    } = await supabase.rpc(
      'notificacion_cancelar_envio',
      {
        envio: id,
        actor,
      }
    );

    if (error) {
      throw error;
    }

    return Boolean(data);
  };

// Obtiene las salitas y especialidades disponibles para notificaciones.
export const opcionesNotificaciones =
  async (
    scope: string[] | null
  ) => {
    const salitas: {
      id_salita: string;
      nombre: string;
    }[] = [];

    const especialidades: {
      id_especialidad: string;
      nombre: string;
    }[] = [];

    // Pagina las salitas para no depender del límite de filas de Supabase.
    for (
      let offset = 0;
      ;
      offset += 500
    ) {
      let query =
        supabase
          .from('salitas')
          .select(
            'id_salita,nombre'
          )
          .eq(
            'activo',
            true
          );

      if (scope !== null) {
        query = query.in(
          'id_salita',
          scope
        );
      }

      const {
        data,
        error,
      } = await query
        .order('nombre')
        .order('id_salita')
        .range(
          offset,
          offset + 499
        );

      if (error) {
        throw error;
      }

      salitas.push(
        ...(data ?? [])
      );

      if (
        !data ||
        data.length < 500
      ) {
        break;
      }
    }

    // Pagina las especialidades para obtener el catálogo completo.
    for (
      let offset = 0;
      ;
      offset += 500
    ) {
      const {
        data,
        error,
      } = await supabase
        .from(
          'especialidades'
        )
        .select(
          'id_especialidad,nombre'
        )
        .eq(
          'activo',
          true
        )
        .order('nombre')
        .order(
          'id_especialidad'
        )
        .range(
          offset,
          offset + 499
        );

      if (error) {
        throw error;
      }

      especialidades.push(
        ...(data ?? [])
      );

      if (
        !data ||
        data.length < 500
      ) {
        break;
      }
    }

    return {
      salitas,
      especialidades,
    };
  };

// Obtiene el nombre visible del remitente.
export const nombreRemitente =
  async (
    id: string
  ) => {
    const {
      data,
      error,
    } = await supabase
      .from('usuarios')
      .select(
        'nombre_usuario,persona:personas(nombres,apellidos)'
      )
      .eq(
        'id_usuario',
        id
      )
      .single();

    if (error) {
      throw error;
    }

    const persona =
      Array.isArray(
        data.persona
      )
        ? data.persona[0]
        : data.persona;

    return persona
      ? `${persona.nombres} ${persona.apellidos}`
      : data.nombre_usuario;
  };