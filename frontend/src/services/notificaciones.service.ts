import api from './api';

import type {
  Audiencia,
  EnvioAdministrativo,
  HistorialEnvios,
  NotificacionesResponse,
  NuevoEnvio,
  OpcionesEnvio,
  PreviewEnvio,
  ProgramacionOriginal,
} from '../types/notificacion.types';

// Obtiene las notificaciones del usuario autenticado.
// La API determina el destinatario a partir de la sesión.
export const getNotificaciones = async (
  page = 1,
  leida?: boolean,
  limit = 15
) =>
  (
    await api.get<NotificacionesResponse>(
      '/notificaciones',
      {
        params: {
          page,
          limit,
          ...(leida === undefined
            ? {}
            : {
                leida: String(leida),
              }),
        },
      }
    )
  ).data;

// Notifica a la interfaz que debe actualizar el estado de las notificaciones.
const actualizarCampana = () => {
  window.dispatchEvent(
    new Event(
      'notificaciones-actualizadas'
    )
  );
};

// Marca una notificación específica como leída.
export const leerNotificacion = async (
  id: string
) => {
  await api.patch(
    `/notificaciones/${id}/leer`
  );

  actualizarCampana();
};

// Marca todas las notificaciones del usuario como leídas.
export const leerTodasNotificaciones =
  async () => {
    await api.patch(
      '/notificaciones/leer-todas'
    );

    actualizarCampana();
  };

// Ruta base para la administración de notificaciones.
const admin =
  '/notificaciones/administrativas';

// Obtiene salitas y especialidades disponibles para crear un envío.
export const getOpcionesEnvio =
  async () =>
    (
      await api.get<OpcionesEnvio>(
        `${admin}/opciones`
      )
    ).data;

// Obtiene una vista previa de los destinatarios de una audiencia.
export const previewEnvio = async (
  audiencia: Audiencia
) =>
  (
    await api.post<PreviewEnvio>(
      `${admin}/preview`,
      {
        audiencia,
      }
    )
  ).data;

// Busca destinatarios dentro de la audiencia seleccionada.
export const buscarDestinatarios =
  async (
    audiencia: Audiencia,
    buscar: string
  ) =>
    (
      await api.post<PreviewEnvio>(
        `${admin}/destinatarios`,
        {
          audiencia,
          buscar,
        }
      )
    ).data;

// Crea un nuevo envío administrativo.
export const crearEnvioAdministrativo =
  async (
    input: NuevoEnvio
  ) =>
    (
      await api.post<{
        envio: {
          id_envio: string;
        };
      }>(
        admin,
        input
      )
    ).data.envio;

// Edita una notificación administrativa programada.
export const editarEnvioAdministrativo =
  async (
    id: string,
    input: NuevoEnvio,
    original: ProgramacionOriginal
  ) =>
    (
      await api.patch<{
        envio: {
          id_envio: string;
        };
      }>(
        `${admin}/${id}`,
        {
          ...input,
          original,
        }
      )
    ).data.envio;

// Obtiene el historial o las notificaciones programadas.
export const getEnvios = async (
  page = 1,
  programadas = false
) =>
  (
    await api.get<HistorialEnvios>(
      admin,
      {
        params: {
          page,
          limit: 5,
          programadas:
            String(
              programadas
            ),
        },
      }
    )
  ).data;

// Obtiene el detalle de un envío administrativo.
export const getEnvio = async (
  id: string
) =>
  (
    await api.get<{
      envio: EnvioAdministrativo;
    }>(
      `${admin}/${id}`
    )
  ).data.envio;

// Cancela una notificación administrativa programada.
export const cancelarEnvio = async (
  id: string
) =>
  (
    await api.patch<{
      envio: EnvioAdministrativo;
    }>(
      `${admin}/${id}/cancelar`
    )
  ).data.envio;