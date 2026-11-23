import {
  supabase,
} from '../config/supabase.js';

// Representa una notificación reclamada para su procesamiento.
export interface Entrega {
  id_notificacion: string;
  id_envio: string;
  id_usuario: string;
  canal: string;
  titulo: string;
  mensaje: string;
  remitente: string;
  procesamiento: string;
}

// Reclama la siguiente notificación pendiente para procesarla.
export const reclamarEntrega =
  async (): Promise<Entrega | null> => {
    const {
      data,
      error,
    } = await supabase.rpc(
      'notificacion_reclamar'
    );

    if (error) {
      throw error;
    }

    return data?.[0] ?? null;
  };

// Finaliza el procesamiento de una notificación.
export const finalizarEntrega =
  async (
    entrega: Entrega,
    estado:
      | 'ENVIADA'
      | 'FALLIDA'
      | 'CANCELADA',
    errorEnvio: string | null
  ) => {
    const {
      error,
    } = await supabase
      .from('notificaciones')
      .update({
        estado_envio:
          estado,

        fecha_envio:
          estado === 'ENVIADA'
            ? new Date().toISOString()
            : null,

        error_envio:
          errorEnvio,

        procesamiento:
          null,
      })
      .eq(
        'id_notificacion',
        entrega.id_notificacion
      )
      .eq(
        'procesamiento',
        entrega.procesamiento
      )
      .eq(
        'estado_envio',
        'PENDIENTE'
      );

    if (error) {
      throw error;
    }
  };