import {
  supabase
} from "../config/supabase.js";

// Datos necesarios para crear una sesión refresh.
interface CreateSessionData {
  id_usuario: string;
  token_hash: string;
  ip_origen: string | null;
  user_agent: string | null;
  fecha_expiracion: string;
}

/**
 * Guarda una nueva sesión refresh.
 *
 * IMPORTANTE:
 * Nunca guardamos el refresh token original.
 * Solo almacenamos su hash SHA-256.
 */
export const createRefreshSession = async (
  session: CreateSessionData
) => {
  const { data, error } = await supabase
    .from("sesiones_refresh")
    .insert({
      id_usuario: session.id_usuario,
      token_hash: session.token_hash,
      ip_origen: session.ip_origen,
      user_agent: session.user_agent,
      fecha_expiracion: session.fecha_expiracion
    })
    .select(`
      id_sesion,
      id_usuario,
      fecha_creacion,
      fecha_expiracion
    `)
    .single();

  if (error) {
    throw new Error(
      `Error creando sesión: ${error.message}`
    );
  }

  return data;
};

/**
 * Busca una sesión mediante
 * el hash del refresh token.
 */
export const findRefreshSession = async (
  tokenHash: string
) => {
  const { data, error } = await supabase
    .from("sesiones_refresh")
    .select(`
      id_sesion,
      id_usuario,
      token_hash,
      fecha_creacion,
      fecha_expiracion,
      fecha_revocacion
    `)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Error buscando sesión: ${error.message}`
    );
  }

  return data;
};

/**
 * Revoca una sesión.
 * No eliminamos el registro.
 * Guardamos cuándo fue revocada.
 */
export const revokeRefreshSession = async (
  idSesion: string
) => {
  const { error } = await supabase
    .from("sesiones_refresh")
    .update({
      fecha_revocacion:
        new Date().toISOString()
    })
    .eq(
      "id_sesion",
      idSesion
    )
    .is(
      "fecha_revocacion",
      null
    );

  if (error) {
    throw new Error(
      `Error revocando sesión: ${error.message}`
    );
  }
};

// Revoca todas las sesiones activas de un usuario.
// Se utiliza, por ejemplo, después de recuperar una contraseña.
export const revokeAllUserRefreshSessions =
  async (
    idUsuario: string
  ) => {
    const { error } = await supabase
      .from("sesiones_refresh")
      .update({
        fecha_revocacion:
          new Date().toISOString()
      })
      .eq("id_usuario", idUsuario)
      .is("fecha_revocacion", null);

    if (error) {
      throw new Error(
        `Error revocando sesiones: ${error.message}`
      );
    }
  };