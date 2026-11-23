// Define los roles disponibles dentro del sistema.
export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN_SALITA'
  | 'RECEPCION'
  | 'PROFESIONAL'
  | 'PACIENTE';

// Representa los datos básicos del usuario autenticado.
export interface AuthUser {
  id_usuario: string;
  email: string;
  nombre_usuario: string;
  rol: UserRole | string;
  id_persona?: string | null;
  email_verificado?: boolean;
  perfil_completo?: boolean;
  permisos?: string[];
  activo?: boolean;
}

// Define las credenciales necesarias para iniciar sesión.
export interface LoginRequest {
  identifier: string;
  password: string;
}

// Contiene los datos y tokens de una sesión autenticada.
export interface LoginResponseData {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

// Representa una sesión que requiere verificar el correo electrónico.
export interface LoginVerificationRequiredData {
  requiresEmailVerification: true;
  email: string;
  loginVerificationToken: string;
  verificationExpiresAt: string | null;
  resendAvailableAt: string | null;
}

// Define los posibles resultados del inicio de sesión.
export type LoginResultData =
  | LoginResponseData
  | LoginVerificationRequiredData;

// Representa una respuesta de inicio de sesión exitoso.
export interface LoginResponse {
  success: boolean;
  message: string;
  data: LoginResponseData;
}

// Representa la respuesta general del inicio de sesión.
export interface LoginResultResponse {
  success: boolean;
  message: string;
  data: LoginResultData;
}

// Define el token necesario para renovar una sesión.
export interface RefreshRequest {
  refreshToken: string;
}

// Contiene los nuevos tokens de autenticación.
export interface RefreshResponseData {
  accessToken: string;
  refreshToken: string;
}

// Representa la respuesta de renovación de sesión.
export interface RefreshResponse {
  success: boolean;
  message: string;
  data: RefreshResponseData;
}

// Define el token utilizado para cerrar la sesión.
export interface LogoutRequest {
  refreshToken: string;
}

// Representa los errores devueltos por la API.
export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

// Define los datos necesarios para registrar un paciente.
export interface RegisterPatientInput {
  email: string;
  password: string;
}

// Define el correo utilizado para solicitar la recuperación de contraseña.
export interface PasswordRecoveryInput {
  email: string;
}

// Permite restablecer la contraseña mediante un token o código.
export type ResetPasswordInput =
  | {
      token: string;
      newPassword: string;
    }
  | {
      email: string;
      code: string;
      newPassword: string;
    };

// Define los datos necesarios para completar el perfil de un paciente.
export type CompletePatientProfileInput = Omit<
  import('./patient.types').CreatePatientRequest,
  'email'
>;

// Representa la respuesta con el perfil completo del usuario.
export interface ProfileResponse {
  success: boolean;
  data: {
    user: AuthUser;
    patient: import('./patient.types').Patient | null;
    person: PersonProfile | null;
    roleInfo: ProfileRoleInfo;
  };
}

// Define los datos personales compartidos por los distintos roles.
export type PersonProfile = Pick<
  import('./patient.types').Patient,
  | 'id_persona'
  | 'dni'
  | 'nombres'
  | 'apellidos'
  | 'fecha_nacimiento'
  | 'sexo'
  | 'telefono'
  | 'email'
  | 'direccion'
  | 'localidad'
  | 'provincia'
  | 'codigo_postal'
>;

// Define los campos personales que el usuario puede actualizar.
export type OwnPersonUpdate = Partial<
  Pick<
    PersonProfile,
    | 'nombres'
    | 'apellidos'
    | 'telefono'
    | 'direccion'
    | 'localidad'
    | 'provincia'
    | 'codigo_postal'
  >
>;

// Contiene la información profesional y las salitas asignadas.
export interface ProfileRoleInfo {
  professional: {
    license: string;
    active: boolean;
    specialties: string[];
  } | null;

  clinics: {
    name: string;
    primary: boolean;
    active: boolean;
  }[];
}

// Define los datos obligatorios y opcionales para completar un perfil personal.
export type CompletePersonInput = Pick<
  PersonProfile,
  | 'dni'
  | 'nombres'
  | 'apellidos'
> &
  Partial<
    Omit<
      PersonProfile,
      | 'id_persona'
      | 'email'
      | 'dni'
      | 'nombres'
      | 'apellidos'
    >
  >;
