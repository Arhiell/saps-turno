import type {
  AuthenticatedUser,
} from '../types/auth.types.js';

import type {
  CrearEnvio,
  EditarEnvio,
} from '../validators/notificacion-admin.validator.js';

import * as repo
  from '../repositories/notificacion-admin.repository.js';

import {
  alcanceNotificaciones,
  validarAudiencia,
} from './notificacion-audiencia.service.js';

import {
  AppError,
} from '../utils/app-error.js';

import {
  findRoleById,
  findUserById,
} from '../repositories/user.repository.js';

// Obtiene las opciones disponibles según el alcance del usuario.
export const opcionesEnvio =
  async (
    user: AuthenticatedUser
  ) =>
    repo.opcionesNotificaciones(
      await alcanceNotificaciones(
        user
      )
    );

// Obtiene el historial de envíos según el alcance del usuario.
export const historialEnvios =
  async (
    user: AuthenticatedUser,
    page: number,
    limit: number,
    programadas: boolean
  ) =>
    repo.consultarEnvios(
      await alcanceNotificaciones(
        user
      ),
      page,
      limit,
      programadas
    );

// Obtiene el detalle de un envío y valida su acceso.
export const detalleEnvio =
  async (
    user: AuthenticatedUser,
    id: string
  ) => {
    const scope =
      await alcanceNotificaciones(
        user
      );

    const envio =
      await repo.consultarEnvio(
        id
      );

    // Verifica que el envío exista y pertenezca al alcance permitido.
    if (
      !envio ||
      (
        scope !== null &&
        (
          !envio.id_salita ||
          !scope.includes(
            envio.id_salita
          )
        )
      )
    ) {
      throw new AppError(
        'El envío no existe o no está dentro de tus salitas.',
        404
      );
    }

    return {
      ...envio,
      fallas:
        await repo.resumenFallas(
          id
        ),
    };
  };

// Prepara los datos necesarios para crear o editar un envío.
const prepararEnvio = async (
  user: AuthenticatedUser,
  input: CrearEnvio
) => {
  // Valida que la audiencia sea accesible para el usuario.
  await validarAudiencia(
    user,
    input.audiencia
  );

  // La programación debe utilizar una fecha futura.
  if (
    input.fecha_programada &&
    Date.parse(
      input.fecha_programada
    ) <= Date.now()
  ) {
    throw new AppError(
      'La fecha programada debe ser futura.',
      400
    );
  }

  const options =
    await opcionesEnvio(
      user
    );

  const salita =
    options.salitas.find(
      (item) =>
        item.id_salita ===
        input.audiencia.id_salita
    );

  const especialidad =
    options.especialidades.find(
      (item) =>
        item.id_especialidad ===
        input.audiencia
          .id_especialidad
    );

  // Verifica que la especialidad seleccionada esté disponible.
  if (
    input.audiencia
      .id_especialidad &&
    !especialidad
  ) {
    throw new AppError(
      'La especialidad no está disponible.',
      400
    );
  }

  const labels = {
    USUARIOS:
      'Todos los usuarios',

    PACIENTES:
      'Pacientes',

    PROFESIONALES:
      'Profesionales',

    ADMINISTRADORES:
      'Administradores',

    ROL:
      `Usuarios del rol ${
        input.audiencia.rol ??
        ''
      }`,
  };

  // Genera una descripción legible de los destinatarios.
  let destinatarios = [
    labels[
      input.audiencia.tipo
    ],
    salita?.nombre,
    especialidad?.nombre,
  ]
    .filter(Boolean)
    .join(' · ');

  // Obtiene los datos del destinatario cuando el envío es individual.
  if (
    input.audiencia.id_usuario
  ) {
    const individual =
      await repo.previewAudiencia(
        input.audiencia,
        user.rol !==
          'SUPER_ADMIN',
        '',
        user.id_usuario
      );

    if (
      !individual.usuarios[0]
    ) {
      throw new AppError(
        'No se encontraron destinatarios autorizados.',
        400
      );
    }

    const tipos:
      Record<string, string> = {
        PACIENTE:
          'Paciente',

        PROFESIONAL:
          'Profesional',

        ADMIN_SALITA:
          'Administrador',

        SUPER_ADMIN:
          'Administración general',

        RECEPCION:
          'Recepción',
      };

    const destinatario =
      individual.usuarios[0];

    destinatarios =
      `${
        tipos[
          destinatario.rol
        ] ?? 'Usuario'
      }: ${
        destinatario.nombre
      }${
        salita
          ? ` · ${salita.nombre}`
          : ''
      }`;
  }

  // Genera el nombre visible del remitente.
  const remitente =
    user.rol === 'SUPER_ADMIN'
      ? 'Administración General SAPS Turno'
      : `${
          await repo.nombreRemitente(
            user.id_usuario
          )
        } · Administración${
          salita
            ? ` - ${salita.nombre}`
            : ''
        }`;

  return {
    ...input,

    id_remitente:
      user.id_usuario,

    id_salita:
      input.audiencia
        .id_salita ??
      null,

    rol_remitente:
      user.rol,

    remitente,

    destinatarios,
  };
};

// Crea un nuevo envío de notificaciones.
export const crearEnvio =
  async (
    user: AuthenticatedUser,
    input: CrearEnvio
  ) => {
    const datos =
      await prepararEnvio(
        user,
        input
      );

    const id =
      await repo.insertarEnvio(
        datos,
        user.rol !==
          'SUPER_ADMIN',
        input.confirmacion
      );

    // El guardado confirmado no depende de consultas posteriores de estadísticas.
    return {
      id_envio: id,
    };
  };

// Edita una notificación programada que todavía no comenzó.
export const editarProgramacion =
  async (
    user: AuthenticatedUser,
    id: string,
    input: EditarEnvio
  ) => {
    const actual =
      await detalleEnvio(
        user,
        id
      );

    // Solo permite modificar programaciones futuras pendientes.
    if (
      actual.estado !==
        'PENDIENTE' ||
      !actual.fecha_programada ||
      Date.parse(
        actual.fecha_programada
      ) <= Date.now()
    ) {
      throw new AppError(
        'Solo se pueden editar programaciones futuras que no comenzaron.',
        409
      );
    }

    await validarAudiencia(
      user,
      input.audiencia
    );

    // Conserva al remitente original y comprueba también su alcance vigente.
    const sender =
      await findUserById(
        actual.id_remitente
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
        actual.rol_remitente
    ) {
      throw new AppError(
        'El remitente original ya no puede realizar este envío. Cancelá la programación.',
        409
      );
    }

    // Prepara nuevamente el envío utilizando al remitente original.
    const datos =
      await prepararEnvio(
        {
          ...sender,
          rol: role.codigo,
        },
        input
      );

    await repo.modificarEnvio(
      id,
      {
        ...datos,
        actor:
          user.id_usuario,
      },
      input.original,
      user.rol !==
        'SUPER_ADMIN' ||
        role.codigo !==
          'SUPER_ADMIN'
    );

    return {
      id_envio: id,
    };
  };

// Cancela un envío programado que todavía no comenzó.
export const cancelarProgramacion =
  async (
    user: AuthenticatedUser,
    id: string
  ) => {
    // Verifica primero que el usuario tenga acceso al envío.
    await detalleEnvio(
      user,
      id
    );

    const cancelado =
      await repo.cancelarEnvio(
        id,
        user.id_usuario
      );

    if (!cancelado) {
      throw new AppError(
        'Solo se pueden cancelar envíos programados que todavía no comenzaron.',
        409
      );
    }

    // Devuelve el envío actualizado después de la cancelación.
    return detalleEnvio(
      user,
      id
    );
  };