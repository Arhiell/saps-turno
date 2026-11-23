import {
  AppError,
} from './app-error.js';

import {
  hasDatabaseCode,
} from './profile-error.js';

// Mensajes utilizados para errores de datos duplicados.
export const duplicateMessages = {
  dni:
    'El DNI ya se encuentra registrado.',
  email:
    'El correo electrónico ya está en uso.',
  username:
    'El nombre de usuario ya existe.',
  matricula:
    'La matrícula profesional ya está registrada.',
} as const;

// Convierte una violación UNIQUE de la base de datos en un error controlado.
export const duplicateError = (
  error: unknown
): AppError | null => {
  if (
    !hasDatabaseCode(
      error,
      '23505'
    )
  ) {
    return null;
  }

  const db = error as {
    constraint?: string;
    message?: string;
    details?: string;
  };

  // Obtiene el nombre de la restricción que produjo el duplicado.
  const constraint =
    db.constraint ??
    db.message?.match(
      /unique constraint "([^"]+)"/
    )?.[1];

  // Relaciona cada restricción con un mensaje seguro para el usuario.
  const messages: Record<
    string,
    string
  > = {
    personas_dni_key:
      duplicateMessages.dni,

    uq_usuarios_nombre_lower:
      duplicateMessages.username,

    uq_usuarios_email_lower:
      duplicateMessages.email,

    uq_personas_email_lower:
      duplicateMessages.email,

    profesionales_matricula_key:
      duplicateMessages.matricula,

    profesionales_id_persona_key:
      duplicateMessages.dni,

    pacientes_id_persona_key:
      duplicateMessages.dni,

    usuarios_id_persona_key:
      'La persona ya tiene una cuenta asociada.',
  };

  let message =
    constraint
      ? messages[constraint]
      : undefined;

  // Obtiene la columna duplicada cuando la restricción tiene otro nombre.
  const key =
    db.details
      ?.match(
        /^Key \((.+?)\)=/
      )?.[1]
      ?.replace(
        /[()\s]/g,
        ''
      )
      .replaceAll(
        '::text',
        ''
      );

  // Asigna el mensaje según la columna detectada.
  if (!message && key) {
    if (key === 'dni') {
      message =
        duplicateMessages.dni;
    }

    if (
      key === 'email' ||
      key === 'loweremail'
    ) {
      message =
        duplicateMessages.email;
    }

    if (
      key ===
        'nombre_usuario' ||
      key ===
        'lowernombre_usuario'
    ) {
      message =
        duplicateMessages.username;
    }

    if (
      key === 'matricula'
    ) {
      message =
        duplicateMessages.matricula;
    }
  }

  // Devuelve un conflicto sin exponer información interna de SQL.
  return new AppError(
    message ??
      'Ya existe un registro con esos datos.',
    409
  );
};