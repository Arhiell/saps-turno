import { supabase } from '../config/supabase.js';

// Busca una cuenta asociada a una persona.
export const findAccountByPersonId = async (
  idPerson: string
) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id_usuario')
    .eq('id_persona', idPerson)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// Obtiene las credenciales y el estado de seguridad de una cuenta.
export const findAccountCredentials = async (
  id: string
) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select(
      'password_hash, activo, email_verificado, intentos_fallidos, bloqueado_hasta'
    )
    .eq('id_usuario', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// Actualiza el nombre de usuario de una cuenta activa.
export const updateUsername = async (
  id: string,
  username: string
) => {
  const { data, error } = await supabase
    .from('usuarios')
    .update({
      nombre_usuario: username,
    })
    .eq('id_usuario', id)
    .eq('activo', true)
    .select('id_usuario')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// Reemplaza la contraseña si el hash anterior coincide.
export const replacePassword = async (
  id: string,
  previousHash: string,
  newHash: string
) => {
  const { data, error } = await supabase
    .from('usuarios')
    .update({
      password_hash: newHash,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
    })
    .eq('id_usuario', id)
    .eq('password_hash', previousHash)
    .eq('activo', true)
    .select('id_usuario')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};