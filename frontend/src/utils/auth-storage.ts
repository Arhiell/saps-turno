import type { AuthUser, PersonProfile } from '../types/auth.types';
import type { Patient } from '../types/patient.types';

const ACCESS_TOKEN_KEY = 'saps_access_token';
const REFRESH_TOKEN_KEY = 'saps_refresh_token';
const USER_KEY = 'saps_user';
const PATIENT_PROFILE_KEY = 'saps_patient_profile';
const PERSON_PROFILE_KEY = 'saps_person_profile';

export const getAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const getStoredUser = (): AuthUser | null => {
  const storedUser = localStorage.getItem(USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
};

export const getStoredPatient = (): Patient | null => {
  const data = localStorage.getItem(PATIENT_PROFILE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as Patient;
  } catch {
    localStorage.removeItem(PATIENT_PROFILE_KEY);
    return null;
  }
};

export const getStoredPerson = (): PersonProfile | null => {
  const data = localStorage.getItem(PERSON_PROFILE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as PersonProfile;
  } catch {
    localStorage.removeItem(PERSON_PROFILE_KEY);
    return null;
  }
};

export const saveStoredProfile = (
  patient: Patient | null,
  person: PersonProfile | null,
): void => {
  if (patient) {
    localStorage.setItem(PATIENT_PROFILE_KEY, JSON.stringify(patient));
  } else {
    localStorage.removeItem(PATIENT_PROFILE_KEY);
  }
  if (person) {
    localStorage.setItem(PERSON_PROFILE_KEY, JSON.stringify(person));
  } else {
    localStorage.removeItem(PERSON_PROFILE_KEY);
  }
};

export const isTokenValid = (token: string | null): boolean => {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    // Válido si le quedan al menos 15 segundos antes de expirar
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + 15_000;
  } catch {
    return false;
  }
};

export const saveAuthSession = (
  accessToken: string,
  refreshToken: string,
  user: AuthUser,
): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const updateAuthTokens = (
  accessToken: string,
  refreshToken: string,
): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  window.dispatchEvent(new Event('saps-session'));
};

export const clearAuthSession = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PATIENT_PROFILE_KEY);
  localStorage.removeItem(PERSON_PROFILE_KEY);
  window.dispatchEvent(new Event('saps-session'));
};

export const saveStoredUser = (
  user: AuthUser,
): void => {
  localStorage.setItem(
    USER_KEY,
    JSON.stringify(user),
  );
};
