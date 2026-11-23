import {
  dniPattern,
  fieldMessages,
  licenseCharacters,
  licensePattern,
  nameCharacters,
  namePattern,
  phoneCharacters,
  phonePattern,
  usernamePattern,
} from '../../../backend/src/validators/field-rules';

// Comparte las reglas de formato con el backend sin importar Zod.
export function fieldRule(
  field: string
) {
  if (
    [
      'nombres',
      'apellidos',
      'contacto_emergencia_nombre',
    ].includes(field)
  ) {
    return {
      pattern: namePattern,
      characters: nameCharacters,
      message:
        fieldMessages.name,
      min:
        field ===
        'contacto_emergencia_nombre'
          ? 1
          : 2,
      max:
        field ===
        'contacto_emergencia_nombre'
          ? 200
          : 100,
    };
  }

  if (field === 'dni') {
    return {
      pattern: dniPattern,
      characters: /^[0-9]*$/,
      message:
        fieldMessages.dni,
      min: 7,
      max: 15,
    };
  }

  if (
    [
      'telefono',
      'contacto_emergencia_telefono',
    ].includes(field)
  ) {
    return {
      pattern: phonePattern,
      characters:
        phoneCharacters,
      message:
        fieldMessages.phone,
      min: 1,
      max: 30,
    };
  }

  if (field === 'matricula') {
    return {
      pattern:
        licensePattern,
      characters:
        licenseCharacters,
      message:
        fieldMessages.license,
      min: 1,
      max: 50,
    };
  }

  if (
    field ===
    'nombre_usuario'
  ) {
    return {
      pattern:
        usernamePattern,
      characters:
        /^[a-zA-Z0-9._-]*$/,
      message:
        fieldMessages.username,
      min: 3,
      max: 60,
    };
  }

  return undefined;
}

// Valida el contenido de un campo según su regla y tipo.
export function fieldError(
  field: string,
  raw: string,
  type?: string
): string {
  const value =
    raw.trim();

  if (!value) {
    return '';
  }

  const rule =
    fieldRule(field);

  if (
    rule &&
    (
      !rule.pattern.test(
        value
      ) ||
      value.length <
        rule.min ||
      value.length >
        rule.max
    )
  ) {
    return `${rule.message} Longitud permitida: ${rule.min} a ${rule.max} caracteres.`;
  }

  // Valida la longitud de la dirección.
  if (
    field === 'direccion' &&
    (
      value.length < 3 ||
      value.length > 250
    )
  ) {
    return 'La dirección debe tener entre 3 y 250 caracteres.';
  }

  // Valida el formato del correo electrónico.
  if (
    (
      type === 'email' ||
      field === 'email'
    ) &&
    (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        value
      ) ||
      value.length > 254
    )
  ) {
    return 'Ingresá un correo electrónico válido.';
  }

  // Valida fechas y evita fechas de nacimiento futuras.
  if (
    type === 'date' ||
    field ===
      'fecha_nacimiento'
  ) {
    const date =
      new Date(
        `${value}T00:00:00Z`
      );

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        value
      ) ||
      !Number.isFinite(
        date.getTime()
      ) ||
      date
        .toISOString()
        .slice(0, 10) !==
        value
    ) {
      return 'Ingresá una fecha válida.';
    }

    if (
      field ===
        'fecha_nacimiento' &&
      value >
        new Date()
          .toISOString()
          .slice(0, 10)
    ) {
      return 'La fecha de nacimiento no puede ser futura.';
    }
  }

  // Valida campos numéricos.
  if (
    type === 'number' &&
    (
      !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(
        value
      ) ||
      !Number.isFinite(
        Number(value)
      )
    )
  ) {
    return 'Ingresá un número válido, sin letras.';
  }

  return '';
}

// Valida los campos principales de una persona.
export function personFieldsError(
  data: object
): string {
  for (
    const [field, value]
    of Object.entries(data)
  ) {
    if (
      [
        'nombres',
        'apellidos',
        'direccion',
        'fecha_nacimiento',
      ].includes(field) &&
      (
        value === null ||
        (
          typeof value ===
            'string' &&
          !value.trim()
        )
      )
    ) {
      return `El campo ${field.replaceAll('_', ' ')} es obligatorio.`;
    }

    if (
      typeof value ===
      'string'
    ) {
      const error =
        fieldError(
          field,
          value
        );

      if (error) {
        return `${field.replaceAll('_', ' ')}: ${error}`;
      }
    }
  }

  return '';
}