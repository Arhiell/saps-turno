import { supabase } from "../config/supabase.js";

/**
 * Busca solamente los datos necesarios
 * para recuperar una contraseña.
 */
export const findRecoveryUserByEmail = async (email: string) => {
  const { data, error } = await supabase
    .from("usuarios")
    .select(
      `
      id_usuario,
      email,
      activo
    `,
    )
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando usuario: ${error.message}`);
  }

  return data;
};

/**
 * Los tokens anteriores todavía no utilizados
 * dejan de ser válidos cuando se genera uno nuevo.
 */
export const invalidatePreviousRecoveryTokens = async (idUsuario: string) => {
  const { error } = await supabase
    .from("tokens_recuperacion")
    .update({
      fecha_uso: new Date().toISOString(),
    })
    .eq("id_usuario", idUsuario)
    .is("fecha_uso", null);

  if (error) {
    throw new Error(`Error invalidando tokens anteriores: ${error.message}`);
  }
};

// Guarda únicamente el HASH del token.
// El token original nunca se almacena.
export const createPasswordRecoveryToken = async (
  idUsuario: string,
  tokenHash: string,
  expiration: string,
  ip: string | null,
) => {
  const { error } = await supabase.from("tokens_recuperacion").insert({
    id_usuario: idUsuario,
    token_hash: tokenHash,
    fecha_expiracion: expiration,
    ip_solicitud: ip,
  });

  if (error) {
    throw new Error(`Error creando token de recuperación: ${error.message}`);
  }
};

export const issuePasswordRecoveryCode = async (
  idUsuario: string,
  codeHash: string,
  expiration: string,
  ip: string | null,
) => {
  const { data, error } = await supabase.rpc(
    "emitir_codigo_recuperacion",
    {
      p_usuario: idUsuario,
      p_hash: codeHash,
      p_expiracion: expiration,
      p_ip: ip,
    },
  );

  if (error) {
    throw new Error(`Error creando código de recuperación: ${error.message}`);
  }

  return data as string | null;
};

export const consumePasswordRecoveryCode = async (
  email: string,
  codeHash: string,
  passwordHash: string,
) => {
  const { data, error } = await supabase.rpc(
    "consumir_codigo_recuperacion",
    {
      p_email: email,
      p_hash: codeHash,
      p_password_hash: passwordHash,
    },
  );

  if (error) {
    throw new Error(`Error verificando código de recuperación: ${error.message}`);
  }

  return data as string;
};

export const invalidatePasswordRecoveryCode = async (idToken: string) => {
  const { error } = await supabase
    .from("tokens_recuperacion")
    .update({ fecha_uso: new Date().toISOString() })
    .eq("id_token", idToken)
    .is("fecha_uso", null);

  if (error) {
    throw new Error(`Error invalidando código de recuperación: ${error.message}`);
  }
};

// Busca un recovery token mediante su hash.
// Solamente devuelve tokens que todavía no fueron utilizados.
export const findPasswordRecoveryToken = async (tokenHash: string) => {
  const { data, error } = await supabase
    .from("tokens_recuperacion")
    .select(
      `
        id_token,
        id_usuario,
        fecha_creacion,
        fecha_expiracion,
        fecha_uso
      `,
    )
    .eq("token_hash", tokenHash)
    .is("fecha_uso", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando token de recuperación: ${error.message}`);
  }

  return data;
};

// Marca el recovery token como utilizado.
// Al tener fecha_uso deja de poder reutilizarse.
export const markRecoveryTokenAsUsed = async (idToken: string) => {
  const { error } = await supabase
    .from("tokens_recuperacion")
    .update({
      fecha_uso: new Date().toISOString(),
    })
    .eq("id_token", idToken);

  if (error) {
    throw new Error(`Error marcando token como utilizado: ${error.message}`);
  }
};

// Actualiza exclusivamente el password_hash del usuario.
export const updateRecoveredPassword = async (idUsuario: string, passwordHash: string) => {
  const { error } = await supabase
    .from("usuarios")
    .update({
      password_hash: passwordHash,

      // También limpiamos bloqueos anteriores.
      intentos_fallidos: 0,
      bloqueado_hasta: null,
    })
    .eq("id_usuario", idUsuario);

  if (error) {
    throw new Error(`Error actualizando contraseña: ${error.message}`);
  }
};
