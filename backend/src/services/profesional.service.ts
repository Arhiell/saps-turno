import {
  createProfesional,
  deleteProfesional,
  findProfesionalIdentity,
  getAllProfesionales,
  getProfesionalById,
  updateProfesional,
} from '../repositories/profesional.repository.js';

import {
  AppError,
} from '../utils/app-error.js';

import {
  duplicateMessages,
} from '../utils/duplicate-error.js';

import {
  createProfesionalSchema,
  updateProfesionalSchema,
  type CreateProfesionalInput,
  type UpdateProfesionalInput,
} from '../validators/profesional.validator.js';

import {
  editPerson,
  findOrCreatePerson,
} from './person.service.js';

import {
  emitirCambioProfesional,
} from './socket.service.js';

// Verifica que la matrícula no pertenezca a otro profesional.
const ensureMatriculaAvailable = async (
  matricula: string,
  id?: string
) => {
  const existing =
    await findProfesionalIdentity(
      'matricula',
      matricula
    );

  if (
    existing &&
    existing.id_profesional !== id
  ) {
    throw new AppError(
      duplicateMessages.matricula,
      409
    );
  }
};

// Obtiene los profesionales según el alcance indicado.
export const getProfesionales = async (
  scope: string[] | null = null
) => {
  return await getAllProfesionales(
    scope, true
  );
};

// Obtiene un profesional por su identificador.
export const getProfesional = async (
  id: string
) => {
  return await getProfesionalById(
    id, true
  );
};

// Valida y registra un nuevo profesional.
export const crearProfesional = async (
  input: CreateProfesionalInput
) => {
  const validated =
    createProfesionalSchema.parse(
      input
    );

  const {
    matricula,
    ...personData
  } = validated;

  // Comprueba la matrícula antes de crear el profesional.
  await ensureMatriculaAvailable(
    matricula
  );

  // Busca o crea la persona asociada.
  const persona =
    await findOrCreatePerson(
      personData
    );

  // Evita asociar la misma persona a más de un profesional.
  if (
    await findProfesionalIdentity(
      'id_persona',
      persona.id_persona
    )
  ) {
    throw new AppError(
      duplicateMessages.dni,
      409
    );
  }

  // Crea el perfil profesional asociado a la persona.
  const created = await createProfesional({
    id_persona:
      persona.id_persona,
    matricula,
  });

  try {
    emitirCambioProfesional({
      tipo: 'PROFESIONAL_CREADO',
      mensaje: `Nuevo profesional registrado: ${personData.apellidos || ''}, ${personData.nombres || ''}`,
      id_profesional: created.id_profesional,
      matricula: created.matricula,
      activo: created.activo,
    });
  } catch {
    // Notificación en tiempo real es complementaria
  }

  return created;
};

// Valida y actualiza los datos de un profesional.
export const actualizarProfesional = async (
  id: string,
  input: UpdateProfesionalInput
) => {
  const validated =
    updateProfesionalSchema.parse(
      input
    );

  const profesional =
    await getProfesionalById(
      id
    );

  if (!profesional) {
    return null;
  }

  // Verifica la disponibilidad de la nueva matrícula.
  if (
    validated.matricula !==
    undefined
  ) {
    await ensureMatriculaAvailable(
      validated.matricula,
      id
    );
  }

  // Separa los datos personales de los datos profesionales.
  const {
    matricula,
    activo,
    fecha_alta,
    fecha_baja,
    ...personData
  } = validated;

  // Actualiza la persona solamente si existen cambios.
  if (
    Object.values(
      personData
    ).some(
      (value) =>
        value !== undefined
    )
  ) {
    await editPerson(
      profesional.id_persona,
      personData
    );
  }

  // Construye únicamente los campos propios del profesional.
  const profesionalData: {
    matricula?: string;
    activo?: boolean;
    fecha_alta?: string;
    fecha_baja?: string | null;
  } = {};

  if (
    matricula !== undefined
  ) {
    profesionalData.matricula =
      matricula;
  }

  if (
    activo !== undefined
  ) {
    profesionalData.activo =
      activo;
  }

  if (
    fecha_alta !== undefined
  ) {
    profesionalData.fecha_alta =
      fecha_alta;
  }

  if (
    fecha_baja !== undefined
  ) {
    profesionalData.fecha_baja =
      fecha_baja;
  }

  // Actualiza los datos profesionales si existen cambios.
  let updated = null;
  if (
    Object.keys(
      profesionalData
    ).length > 0
  ) {
    updated = await updateProfesional(
      id,
      profesionalData
    );
  } else {
    // Devuelve el profesional actualizado cuando solo cambió la persona.
    updated = await getProfesionalById(
      id
    );
  }

  if (updated) {
    try {
      emitirCambioProfesional({
        tipo: 'PROFESIONAL_ACTUALIZADO',
        mensaje: `Profesional actualizado`,
        id_profesional: id,
        matricula: updated.matricula,
        activo: updated.activo,
      });
    } catch {
      // Notificación en tiempo real es complementaria
    }
  }

  return updated;
};

// Elimina un profesional por su identificador.
export const eliminarProfesional = async (
  id: string
) => {
  const result = await deleteProfesional(id);
  try {
    emitirCambioProfesional({
      tipo: 'PROFESIONAL_ACTUALIZADO',
      mensaje: 'Profesional desactivado',
      id_profesional: id,
      activo: false,
    });
  } catch {
    // Notificación en tiempo real es complementaria
  }
  return result;
};
