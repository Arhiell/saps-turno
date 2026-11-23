import {
  supabase,
} from '../config/supabase.js';

// Consume un código de email mediante la función RPC.
// Puede utilizarse para verificación o cambio de correo.
export const consumeEmailCode = async (
  userId: string,
  hash: string,
  newEmail: string | null
) => {
  const {
    data,
    error,
  } = await supabase.rpc(
    'consumir_codigo_email',
    {
      p_usuario: userId,
      p_hash: hash,
      p_nuevo_email: newEmail,
    }
  );

  if (error) {
    throw error;
  }

  return data as string;
};

// Genera un nuevo código de verificación mediante RPC.
export const issueEmailCode = async (
  userId: string,
  hash: string,
  expires: string,
  ip: string | null,
  newEmail: string | null
) => {
  const {
    data,
    error,
  } = await supabase.rpc(
    'emitir_codigo_email',
    {
      p_usuario: userId,
      p_hash: hash,
      p_expiracion: expires,
      p_ip: ip,
      p_nuevo_email: newEmail,
    }
  );

  if (error) {
    throw error;
  }

  return data as string | null;
};

// Invalida un código de email pendiente.
export const invalidateEmailCode = async (
  id: string
) => {
  const {
    error,
  } = await supabase
    .from('tokens_verificacion_email')
    .update({
      fecha_uso: new Date().toISOString(),
    })
    .eq('id_token', id)
    .is('fecha_uso', null);

  if (error) {
    throw error;
  }
};

/**
 * Busca el usuario necesario para
 * el proceso de verificación.
 */
export const findUserForEmailVerification = async (
  email: string
) => {
  const {
    data,
    error,
  } = await supabase
    .from('usuarios')
    .select(
      `
        id_usuario,
        email,
        email_verificado,
        activo
      `
    )
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Error buscando usuario: ${error.message}`
    );
  }

  return data;
};

// Invalida tokens anteriores todavía pendientes de ese usuario.
export const invalidatePreviousEmailTokens = async (
  idUsuario: string
) => {
  const {
    error,
  } = await supabase
    .from('tokens_verificacion_email')
    .update({
      fecha_uso: new Date().toISOString(),
    })
    .eq('id_usuario', idUsuario)
    .is('fecha_uso', null);

  if (error) {
    throw new Error(
      `Error invalidando tokens de email: ${error.message}`
    );
  }
};

// Guarda solamente el HASH del token.
export const createEmailVerificationToken = async (
  idUsuario: string,
  tokenHash: string,
  expiration: string,
  ip: string | null,
  change?: {
    nuevo_email: string;
    email_anterior: string;
  }
) => {
  const {
    error,
  } = await supabase
    .from('tokens_verificacion_email')
    .insert({
      id_usuario: idUsuario,
      token_hash: tokenHash,
      fecha_expiracion: expiration,
      ip_solicitud: ip,
      intentos: 0,
      ...change,
    });

  if (error) {
    throw new Error(
      `Error creando token de email: ${error.message}`
    );
  }
};

// Busca un token de verificación todavía no utilizado.
export const findEmailVerificationToken = async (
  tokenHash: string
) => {
  const {
    data,
    error,
  } = await supabase
    .from('tokens_verificacion_email')
    .select(
      `
        id_token,
        id_usuario,
        fecha_expiracion,
        fecha_uso
      `
    )
    .eq('token_hash', tokenHash)
    .is('nuevo_email', null)
    .is('fecha_uso', null)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Error buscando token de email: ${error.message}`
    );
  }

  return data;
};

// Marca el correo del usuario como verificado.
export const markEmailAsVerified = async (
  idUsuario: string
) => {
  const {
    error,
  } = await supabase
    .from('usuarios')
    .update({
      email_verificado: true,
    })
    .eq('id_usuario', idUsuario);

  if (error) {
    throw new Error(
      `Error verificando correo: ${error.message}`
    );
  }
};

// Marca el token como utilizado.
export const markEmailTokenAsUsed = async (
  idToken: string
) => {
  const {
    data,
    error,
  } = await supabase
    .from('tokens_verificacion_email')
    .update({
      fecha_uso: new Date().toISOString(),
    })
    .eq('id_token', idToken)
    .is('fecha_uso', null)
    .select('id_token')
    .maybeSingle();

  if (error) {
    throw new Error(
      `Error marcando token como utilizado: ${error.message}`
    );
  }

  return Boolean(data);
};

// Busca el último código pendiente generado para un usuario.
export const findLatestPendingEmailToken = async (
  idUsuario: string
) => {
  const {
    data,
    error,
  } = await supabase
    .from('tokens_verificacion_email')
    .select(
      `
        id_token,
        token_hash,
        fecha_expiracion,
        fecha_creacion,
        intentos,
        nuevo_email,
        email_anterior
      `
    )
    .eq('id_usuario', idUsuario)
    .is('fecha_uso', null)
    .order(
      'fecha_creacion',
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Error buscando código de email: ${error.message}`
    );
  }

  return data;
};

// Registra un intento de validación del código.
// Si corresponde, también invalida el token.
export const registerEmailCodeAttempt = async (
  idToken: string,
  attempts: number,
  invalidate: boolean
) => {
  const {
    data,
    error,
  } = await supabase
    .from('tokens_verificacion_email')
    .update({
      intentos: attempts,
      ...(invalidate
        ? {
            fecha_uso: new Date().toISOString(),
          }
        : {}),
    })
    .eq('id_token', idToken)
    .is('fecha_uso', null)
    .select('id_token')
    .maybeSingle();

  if (error) {
    throw new Error(
      `Error registrando intento de email: ${error.message}`
    );
  }

  return Boolean(data);
};