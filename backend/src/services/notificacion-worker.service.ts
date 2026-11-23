import {
  z,
} from 'zod';

import {
  finalizarEntrega,
  reclamarEntrega,
  type Entrega,
} from '../repositories/notificacion-worker.repository.js';

import {
  consultarCabeceraEnvio,
  previewAudiencia,
} from '../repositories/notificacion-admin.repository.js';

import {
  findRoleById,
  findUserById,
} from '../repositories/user.repository.js';

import {
  validarAudiencia,
} from './notificacion-audiencia.service.js';

import {
  sendEmail,
} from './email.service.js';

import {
  AppError,
} from '../utils/app-error.js';

import {
  buildNotificacionEmail,
} from './notificacion-email-template.service.js';

// Procesa una entrega reclamada de la cola de notificaciones.
const procesarEntrega =
  async (
    entrega: Entrega
  ) => {
    const envio =
      await consultarCabeceraEnvio(
        entrega.id_envio
      );

    if (!envio) {
      throw new Error(
        'No se encontró la cabecera del envío.'
      );
    }

    // Obtiene y valida al remitente original del envío.
    const sender =
      await findUserById(
        envio.id_remitente
      );

    const role =
      sender
        ? await findRoleById(
            sender.id_rol
          )
        : null;

    if (
      !sender?.activo ||
      !role?.activo ||
      role.codigo !==
        envio.rol_remitente
    ) {
      await finalizarEntrega(
        entrega,
        'CANCELADA',
        'El remitente ya no tiene autorización para este envío.'
      );

      return;
    }

    try {
      // Revalida permisos y relaciones al ejecutar una programación.
      await validarAudiencia(
        {
          ...sender,
          rol: role.codigo,
        },
        envio.audiencia
      );
    } catch (error) {
      if (
        !(
          error instanceof
          AppError
        )
      ) {
        throw error;
      }

      await finalizarEntrega(
        entrega,
        'CANCELADA',
        'El remitente ya no tiene acceso a la audiencia.'
      );

      return;
    }

    // Comprueba que el destinatario continúe dentro de la audiencia.
    const audience =
      await previewAudiencia(
        {
          ...envio.audiencia,
          id_usuario:
            entrega.id_usuario,
        },
        role.codigo !==
          'SUPER_ADMIN',
        ''
      );

    const recipient =
      audience.usuarios[0];

    if (!recipient) {
      await finalizarEntrega(
        entrega,
        'CANCELADA',
        'El destinatario ya no pertenece a la audiencia autorizada.'
      );

      return;
    }

    // Procesa la entrega por correo cuando corresponde.
    if (
      entrega.canal ===
      'EMAIL'
    ) {
      const validEmail =
        z
          .string()
          .email()
          .safeParse(
            recipient.email
          )
          .success;

      if (!validEmail) {
        await finalizarEntrega(
          entrega,
          'FALLIDA',
          'El destinatario no tiene un correo válido.'
        );

        return;
      }

      try {
        const result =
          await sendEmail({
            to: recipient.email,
            ...buildNotificacionEmail(
              entrega
            ),
          });

        if (
          !result.accepted.length
        ) {
          throw new Error(
            'Correo rechazado por SMTP'
          );
        }
      } catch (error) {
        console.error(
          'Falló correo administrativo',
          entrega.id_notificacion,
          error
        );

        await finalizarEntrega(
          entrega,
          'FALLIDA',
          'No se pudo confirmar el envío del correo. La entrega interna se procesa por separado.'
        );

        return;
      }
    }

    // Marca la entrega como completada correctamente.
    await finalizarEntrega(
      entrega,
      'ENVIADA',
      null
    );
  };

// Inicia el procesador de la cola de notificaciones.
export const iniciarProcesadorNotificaciones =
  (tareaPeriodica?: () => Promise<void>) => {
    let stopped = false;
    let periodic: Promise<void> | undefined;

    let timer:
      ReturnType<
        typeof setTimeout
      >
      | undefined;

    let running:
      Promise<void> =
      Promise.resolve();

    // Procesa un lote de entregas pendientes.
    const tick =
      async () => {
        let more = false;
        if (tareaPeriodica && !periodic && !stopped) {
          periodic = tareaPeriodica().catch(error => console.error('No se pudo procesar el calendario institucional', error))
            .finally(() => { periodic = undefined; });
        }

        try {
          // Procesa hasta 50 entregas por ciclo.
          for (
            let index = 0;
            index < 50 &&
            !stopped;
            index++
          ) {
            const entrega =
              await reclamarEntrega();

            if (!entrega) {
              break;
            }

            more = true;

            await procesarEntrega(
              entrega
            );
          }
        } catch (error) {
          more = false;

          console.error(
            'No se pudo procesar la cola de notificaciones administrativas',
            error
          );
        }

        // Reduce la espera cuando todavía existen entregas por procesar.
        if (!stopped) {
          timer = setTimeout(
            () => {
              running =
                tick();
            },
            more
              ? 100
              : 15000
          );
        }
      };

    // Inicia el primer ciclo del procesador.
    running = tick();

    // Detiene el procesador y espera a que finalice el ciclo actual.
    return async () => {
      stopped = true;

      if (timer) {
        clearTimeout(
          timer
        );
      }

      await running;
      await periodic;
    };
  };
