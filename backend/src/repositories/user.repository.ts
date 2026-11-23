import { literalLikePattern } from '../utils/like-pattern.js';
import { supabase } from '../config/supabase.js';

// Cuenta la cantidad total de usuarios registrados.
export const countUsers = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('usuarios')
    .select('id_usuario', {
      count: 'exact',
      head: true,
    });

  if (error) {
    throw new Error(`Error consultando usuarios: ${error.message}`);
  }

  return count ?? 0;
};

// Cuenta la cantidad total de roles registrados.
export const countRoles = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('roles')
    .select('id_rol', {
      count: 'exact',
      head: true,
    });

  if (error) {
    throw new Error(`Error consultando roles: ${error.message}`);
  }

  return count ?? 0;
};

// Define los datos públicos de una cuenta de usuario.
export interface UserAccount {
  id_usuario: string;
  nombre_usuario: string;
  email: string;
  email_verificado: boolean;
  activo: boolean;
  fecha_creacion: string;
}

// Define los datos necesarios para registrar un usuario.
export interface CreateUserData {
  id_persona?: string | null;
  id_rol: string;
  nombre_usuario: string;
  email: string;
  password_hash: string;
}

// Busca un usuario por su correo electrónico.
export const findUserByEmail = async (
  email: string
) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id_usuario, email')
    .ilike('email', literalLikePattern(email))
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando usuario por email: ${error.message}`);
  }

  return data;
};

// Busca un usuario por su nombre de usuario.
export const findUserByUsername = async (
  nombreUsuario: string
) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id_usuario, nombre_usuario')
    .ilike('nombre_usuario', literalLikePattern(nombreUsuario))
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando nombre de usuario: ${error.message}`);
  }

  return data;
};

// Busca un rol activo mediante su código.
export const findRoleByCode = async (
  codigo: string
) => {
  const { data, error } = await supabase
    .from('roles')
    .select('id_rol, codigo, nombre')
    .eq('codigo', codigo)
    .eq('activo', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando rol: ${error.message}`);
  }

  return data;
};

// Registra un usuario y devuelve los datos de su cuenta.
export const createUser = async (
  userData: CreateUserData
): Promise<UserAccount> => {
  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      id_persona: userData.id_persona ?? null,
      id_rol: userData.id_rol,
      nombre_usuario: userData.nombre_usuario,
      email: userData.email,
      password_hash: userData.password_hash,
    })
    .select(
      'id_usuario, nombre_usuario, email, email_verificado, activo, fecha_creacion'
    )
    .single();

  if (error) {
    throw error;
  }

  return data;
};

// Busca las credenciales de un usuario para iniciar sesión.
export const findUserForLogin = async (
  identifier: string
) => {
  const sanitized = identifier.trim().toLowerCase();
  const escaped = sanitized.replace(/"/g, '\\"');
  const { data, error } = await supabase
    .from('usuarios')
    .select(
      'id_usuario, id_rol, id_persona, nombre_usuario, email, password_hash, email_verificado, intentos_fallidos, bloqueado_hasta, activo'
    )
    .or(`email.ilike."${escaped}",nombre_usuario.ilike."${escaped}"`)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando usuario: ${error.message}`);
  }

  return data;
};

// Obtiene un rol mediante su identificador.
export const findRoleById = async (
  idRol: string
) => {
  const { data, error } = await supabase
    .from('roles')
    .select('id_rol, codigo, nombre, activo')
    .eq('id_rol', idRol)
    .maybeSingle();

  if (error) {
    throw new Error(`Error obteniendo rol: ${error.message}`);
  }

  return data;
};

// Obtiene los datos de un usuario mediante su identificador.
export const findUserById = async (
  idUsuario: string
) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select(
      'id_usuario, id_rol, id_persona, nombre_usuario, email, email_verificado, activo'
    )
    .eq('id_usuario', idUsuario)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando usuario: ${error.message}`);
  }

  return data;
};

// Registra un inicio de sesión exitoso y reinicia los intentos fallidos.
export const registerSuccessfulLogin = async (
  idUsuario: string
) => {
  const { error } = await supabase
    .from('usuarios')
    .update({
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      ultimo_acceso: new Date().toISOString(),
    })
    .eq('id_usuario', idUsuario);

  if (error) {
    throw new Error(`Error actualizando acceso: ${error.message}`);
  }
};

// Busca una salita activa mediante su identificador.
export const findActiveSalitaById = async (
  idSalita: string
) => {
  const { data, error } = await supabase
    .from('salitas')
    .select('id_salita, nombre, activo')
    .eq('id_salita', idSalita)
    .eq('activo', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando salita: ${error.message}`);
  }

  return data;
};

// Asigna una salita principal a un usuario administrativo.
export const assignUserToSalita = async (
  idUsuario: string,
  idSalita: string
) => {
  const { error } = await supabase
    .from('usuario_salita')
    .insert({
      id_usuario: idUsuario,
      id_salita: idSalita,
      es_principal: true,
      activo: true,
    });

  if (error) {
    throw new Error(`Error asignando usuario a salita: ${error.message}`);
  }
};

// Registra un intento fallido y actualiza el bloqueo de la cuenta.
export const registerFailedLogin = async (
  idUsuario: string,
  attempts: number,
  blockedUntil: string | null
) => {
  const { error } = await supabase
    .from('usuarios')
    .update({
      intentos_fallidos: attempts,
      bloqueado_hasta: blockedUntil,
    })
    .eq('id_usuario', idUsuario);

  if (error) {
    throw new Error(`Error registrando intento fallido: ${error.message}`);
  }
};

// Elimina un bloqueo vencido y reinicia los intentos fallidos.
export const clearExpiredLoginLock = async (
  idUsuario: string
) => {
  const { error } = await supabase
    .from('usuarios')
    .update({
      intentos_fallidos: 0,
      bloqueado_hasta: null,
    })
    .eq('id_usuario', idUsuario);

  if (error) {
    throw new Error(`Error limpiando bloqueo: ${error.message}`);
  }
};

// Marca el correo electrónico del usuario como verificado.
export const verifyUserEmailDirectly = async (
  idUsuario: string
) => {
  const { error } = await supabase
    .from('usuarios')
    .update({
      email_verificado: true,
    })
    .eq('id_usuario', idUsuario);

  if (error) {
    throw new Error(`Error verificando email del usuario: ${error.message}`);
  }
};