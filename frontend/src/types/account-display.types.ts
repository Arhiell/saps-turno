// Datos públicos de la cuenta para paneles administrativos; sin credenciales.
export interface AccountDisplay {
  id_usuario: string;
  nombre_usuario: string;
  email: string;
  email_verificado: boolean;
  activo: boolean;
  persona?: { nombres: string; apellidos: string } | null;
  rol: { codigo: string };
}
