// Reglas puras compartidas con los formularios, sin dependencias del servidor.
export const namePattern =
  /^\p{L}[\p{L}\p{M}]*(?:(?: +|['\u2019-])\p{L}[\p{L}\p{M}]*)*$/u;

export const nameCharacters =
  /^[\p{L}\p{M} '\u2019-]*$/u;

export const phonePattern =
  /^\+?[0-9]+(?:[ -][0-9]+)*$/;

export const phoneCharacters =
  /^\+?[0-9 -]*$/;

export const dniPattern =
  /^[0-9]{7,15}$/;

// La matrícula admite prefijos y separadores.
export const licensePattern =
  /^[A-Za-z0-9]+(?:[ ./-][A-Za-z0-9]+)*$/;

export const licenseCharacters =
  /^[A-Za-z0-9 ./-]*$/;

export const usernamePattern =
  /^[a-zA-Z0-9._-]+$/;

// Mensajes utilizados por las validaciones de campos.
export const fieldMessages = {
  name:
    'Usá solo letras, espacios, tildes, ñ, guiones o apóstrofes entre nombres.',

  phone:
    'El teléfono debe contener números; puede incluir + al inicio, espacios o guiones.',

  dni:
    'El DNI debe contener entre 7 y 15 números, sin letras ni símbolos.',

  license:
    'La matrícula admite letras, números y separadores (espacio, punto, guion o barra).',

  username:
    'El usuario solo puede contener letras, números, punto, guion y guion bajo.',
};
