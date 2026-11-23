/**
 * Utilidad para la resolución y presentación del parentesco desde la perspectiva
 * del usuario autenticado (titular/tutor) hacia la persona a cargo (paciente dependiente).
 */

export interface KinshipResolutionParams {
  storedRelationship: string;
  dependentSex?: string | null;
  dependentBirthDate?: string | null;
  userSex?: string | null;
  userBirthDate?: string | null;
}

/**
 * Calcula la edad en años a partir de una fecha de nacimiento YYYY-MM-DD.
 */
export const calculateAgeFromBirthDate = (birth?: string | null): number | null => {
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
 * Resuelve la denominación del parentesco desde la perspectiva del usuario autenticado.
 *
 * Ejemplos:
 * - Si el usuario es la madre (guardado 'Madre'): muestra 'Hijo' o 'Hija'.
 * - Si es el padre (guardado 'Padre'): muestra 'Hijo' o 'Hija'.
 * - Si el usuario es el hijo y gestiona a su madre/padre (guardado 'Hijo'): muestra 'Madre' o 'Padre'.
 * - Si son hermanos (guardado 'Hermano' o 'Hermana'): muestra 'Hermano' o 'Hermana'.
 * - Si es tutor legal (guardado 'Tutor legal' o 'Tutor'): muestra 'Persona tutelada'.
 */
export const resolveManagedKinship = ({
  storedRelationship,
  dependentSex,
  dependentBirthDate,
  userSex,
  userBirthDate,
}: KinshipResolutionParams): string => {
  const raw = (storedRelationship || '').trim();
  if (!raw) return 'Persona a cargo';

  const lower = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const userAge = calculateAgeFromBirthDate(userBirthDate);
  const dependentAge = calculateAgeFromBirthDate(dependentBirthDate);
  const userIsOlder = userAge !== null && dependentAge !== null ? userAge > dependentAge : null;
  const ageDifference = userAge !== null && dependentAge !== null ? userAge - dependentAge : null;

  const isFemaleDependent = dependentSex === 'FEMENINO';
  const isMaleDependent = dependentSex === 'MASCULINO';

  // 1. Caso Tutor Legal / Curatela / Guarda
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
    // Si el usuario es mayor que el dependiente, el usuario es el abuelo y el dependiente es el nieto
    if (userIsOlder === true || (dependentAge !== null && dependentAge < 18)) {
      return isFemaleDependent ? 'Nieta' : isMaleDependent ? 'Nieto' : 'Nieto/a';
    }
    // Si el dependiente es mayor, el dependiente es el abuelo
    if (userIsOlder === false) {
      return isFemaleDependent ? 'Abuela' : isMaleDependent ? 'Abuelo' : 'Abuelo/a';
    }
    return isFemaleDependent ? 'Nieta' : 'Nieto';
  }

  if (lower.includes('niet')) {
    // Si el usuario es mayor, el dependiente es el nieto
    if (userIsOlder === true || (dependentAge !== null && dependentAge < 18)) {
      return isFemaleDependent ? 'Nieta' : isMaleDependent ? 'Nieto' : 'Nieto/a';
    }
    // Si el dependiente es mayor, el dependiente es el abuelo
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
  // El texto guardado menciona madre/padre/progenitor
  if (
    lower.includes('madr') ||
    lower.includes('mama') ||
    lower.includes('padr') ||
    lower.includes('papa') ||
    lower.includes('progenitor')
  ) {
    // Si el dependiente es varón pero la relación guardada es 'Madre' (o viceversa):
    // El dependiente no puede ser la 'Madre'. La madre es la usuaria titular.
    // Por ende, el dependiente es el 'Hijo'.
    if (isMaleDependent && (lower.includes('madr') || lower.includes('mama'))) {
      return 'Hijo';
    }
    if (isFemaleDependent && (lower.includes('padr') || lower.includes('papa'))) {
      return 'Hija';
    }

    // Análisis de edades
    // Si el usuario es mayor (generación progenitora) o el dependiente es menor de edad:
    if (userIsOlder === true || (ageDifference !== null && ageDifference >= 12) || (dependentAge !== null && dependentAge < 18)) {
      return isFemaleDependent ? 'Hija' : isMaleDependent ? 'Hijo' : 'Hijo/a';
    }

    // Si el dependiente es mayor que el usuario por 12+ años, el dependiente es el progenitor
    if (userIsOlder === false && ageDifference !== null && ageDifference <= -12) {
      if (isFemaleDependent || lower.includes('madr') || lower.includes('mama')) return 'Madre';
      if (isMaleDependent || lower.includes('padr') || lower.includes('papa')) return 'Padre';
      return 'Madre/Padre';
    }

    // Por defecto en CORA, la relación guardada al vincular un tutor registra el rol del tutor:
    // "Madre" -> la tutora es la madre -> el paciente dependiente es el hijo/hija.
    if (isFemaleDependent) return 'Hija';
    if (isMaleDependent) return 'Hijo';
    return 'Hijo/a';
  }

  // 6. Caso Hijo / Hija
  // El texto guardado menciona hijo/hija
  if (lower.includes('hij')) {
    // Si el dependiente es menor de edad o el usuario es mayor: el dependiente es el hijo
    if (userIsOlder === true || (dependentAge !== null && dependentAge < 18)) {
      return isFemaleDependent ? 'Hija' : isMaleDependent ? 'Hijo' : (lower.includes('hija') ? 'Hija' : 'Hijo');
    }

    // Si el dependiente es mayor que el usuario (el usuario adulto está gestionando a su madre o padre):
    if (userIsOlder === false && ageDifference !== null && ageDifference <= -12) {
      return isFemaleDependent ? 'Madre' : isMaleDependent ? 'Padre' : 'Madre/Padre';
    }

    // Si el sexo del dependiente concuerda con 'hijo' o 'hija'
    if (isFemaleDependent) return 'Hija';
    if (isMaleDependent) return 'Hijo';
    return lower.includes('hija') ? 'Hija' : 'Hijo';
  }

  // 7. Cónyuges
  if (lower.includes('conyuge') || lower.includes('pareja') || lower.includes('espos')) {
    return isFemaleDependent ? 'Esposa' : isMaleDependent ? 'Esposo' : 'Cónyuge';
  }

  // Si no coincide con ninguna regla anterior, se formatea la cadena original con mayúscula inicial
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
};
