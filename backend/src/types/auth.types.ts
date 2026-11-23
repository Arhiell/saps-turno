// Información minima que conocemos del usarios autenticado

export interface AuthenticatedUser {
    id_usuario: string;
    email: string;
    nombre_usuario: string;
    rol: string;
    id_rol?: string;
    id_persona?: string | null;
    email_verificado?: boolean;
    perfil_completo?: boolean;
}
