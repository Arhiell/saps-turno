/**
 * Utilidad de formato y resolución de parentesco desde la perspectiva del usuario autenticado.
 */

export interface KinshipParticipant {
  parentesco?: string;
  parentesco_representado?: string;
  sexo?: string | null;
  fecha_nacimiento?: string | null;
  nombres?: string;
  apellidos?: string;
}

/**
 * Calcula la edad en años a partir de una fecha de nacimiento YYYY-MM-DD.
 */
export const calculateAge = (birth?: string | null): number | null => {
  if (!birth) return null;
  const d = new Date(`${birth}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  if (
    today.getMonth() < d.getMonth() ||
    (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())
  ) {
    age--;
  }
  return age >= 0 ? age : null;
};

/**
 * Presenta el parentesco de una persona a cargo desde la perspectiva del usuario autenticado.
 *
 * Ejemplos:
 * - Si el usuario es la madre (guardado 'Madre'): muestra 'Hijo' o 'Hija'.
 * - Si es el padre (guardado 'Padre'): muestra 'Hijo' o 'Hija'.
 * - Si es el hijo: muestra 'Madre' o 'Padre'.
 * - Si es hermano: muestra 'Hermano' o 'Hermana'.
 * - Si es tutor legal: muestra 'Persona tutelada'.
 */
export const formatManagedKinship = (
  dependent: KinshipParticipant,
  titular?: KinshipParticipant | null
): string => {
  // Si el backend ya proporcionó la versión adaptada
  if (dependent.parentesco_representado) {
    return dependent.parentesco_representado;
  }

  const raw = (dependent.parentesco || '').trim();
  if (!raw) return 'Persona a cargo';

  const lower = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const userAge = titular ? calculateAge(titular.fecha_nacimiento) : null;
  const dependentAge = calculateAge(dependent.fecha_nacimiento);
  const userIsOlder = userAge !== null && dependentAge !== null ? userAge > dependentAge : null;
  const ageDifference = userAge !== null && dependentAge !== null ? userAge - dependentAge : null;

  const isFemaleDependent = dependent.sexo === 'FEMENINO';
  const isMaleDependent = dependent.sexo === 'MASCULINO';

  // 1. Caso Tutor Legal / Tutela / Guarda
  if (
    lower.includes('tutor') ||
    lower.includes('curador') ||
    lower.includes('guarda') ||
    lower.includes('legal') ||
    lower.includes('apoderad') ||
    lower.includes('responsable') ||
    lower.includes('tutelad')
  ) {
    return 'Persona tutelada';
  }

  // 2. Caso Hermanos
  if (lower.includes('herman')) {
    if (isFemaleDependent) return 'Hermana';
    if (isMaleDependent) return 'Hermano';
    return lower.includes('hermana') ? 'Hermana' : 'Hermano';
  }

  // 3. Caso Abuelos / Nietos
  if (lower.includes('abuel')) {
    if (userIsOlder === true || (dependentAge !== null && dependentAge < 18)) {
      return isFemaleDependent ? 'Nieta' : isMaleDependent ? 'Nieto' : 'Nieto/a';
    }
    if (userIsOlder === false) {
      return isFemaleDependent ? 'Abuela' : isMaleDependent ? 'Abuelo' : 'Abuelo/a';
    }
    return isFemaleDependent ? 'Nieta' : 'Nieto';
  }

  if (lower.includes('niet')) {
    if (userIsOlder === true || (dependentAge !== null && dependentAge < 18)) {
      return isFemaleDependent ? 'Nieta' : isMaleDependent ? 'Nieto' : 'Nieto/a';
    }
    if (userIsOlder === false) {
      return isFemaleDependent ? 'Abuela' : isMaleDependent ? 'Abuelo' : 'Abuelo/a';
    }
    return isFemaleDependent ? 'Nieta' : 'Nieto';
  }

  // 4. Caso Tíos / Sobrinos
  if (lower.includes('tio') || lower.includes('tia')) {
    if (userIsOlder === true || (dependentAge !== null && dependentAge < 18)) {
      return isFemaleDependent ? 'Sobrina' : isMaleDependent ? 'Sobrino' : 'Sobrino/a';
    }
    if (userIsOlder === false) {
      return isFemaleDependent ? 'Tía' : isMaleDependent ? 'Tío' : 'Tío/a';
    }
    return isFemaleDependent ? 'Sobrina' : 'Sobrino';
  }

  if (lower.includes('sobrin')) {
    return isFemaleDependent ? 'Sobrina' : isMaleDependent ? 'Sobrino' : 'Sobrino/a';
  }

  // 5. Caso Madre / Padre
  if (
    lower.includes('madr') ||
    lower.includes('mama') ||
    lower.includes('padr') ||
    lower.includes('papa') ||
    lower.includes('progenitor')
  ) {
    // Si el dependiente es varón y el texto dice 'Madre', no puede ser la madre, es el hijo
    if (isMaleDependent && (lower.includes('madr') || lower.includes('mama'))) {
      return 'Hijo';
    }
    if (isFemaleDependent && (lower.includes('padr') || lower.includes('papa'))) {
      return 'Hija';
    }

    if (userIsOlder === true || (ageDifference !== null && ageDifference >= 12) || (dependentAge !== null && dependentAge < 18)) {
      return isFemaleDependent ? 'Hija' : isMaleDependent ? 'Hijo' : 'Hijo/a';
    }

    if (userIsOlder === false && ageDifference !== null && ageDifference <= -12) {
      if (isFemaleDependent || lower.includes('madr') || lower.includes('mama')) return 'Madre';
      if (isMaleDependent || lower.includes('padr') || lower.includes('papa')) return 'Padre';
      return 'Madre/Padre';
    }

    if (isFemaleDependent) return 'Hija';
    if (isMaleDependent) return 'Hijo';
    return 'Hijo/a';
  }

  // 6. Caso Hijo / Hija
  if (lower.includes('hij')) {
    if (userIsOlder === true || (dependentAge !== null && dependentAge < 18)) {
      return isFemaleDependent ? 'Hija' : isMaleDependent ? 'Hijo' : (lower.includes('hija') ? 'Hija' : 'Hijo');
    }

    if (userIsOlder === false && ageDifference !== null && ageDifference <= -12) {
      return isFemaleDependent ? 'Madre' : isMaleDependent ? 'Padre' : 'Madre/Padre';
    }

    if (isFemaleDependent) return 'Hija';
    if (isMaleDependent) return 'Hijo';
    return lower.includes('hija') ? 'Hija' : 'Hijo';
  }

  // 7. Cónyuges
  if (lower.includes('conyuge') || lower.includes('pareja') || lower.includes('espos')) {
    return isFemaleDependent ? 'Esposa' : isMaleDependent ? 'Esposo' : 'Cónyuge';
  }

  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
};
