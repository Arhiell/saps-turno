import { literalLikePattern } from "../utils/like-pattern.js";
import {
  supabase }
   from "../config/supabase.js";

/**
 * Busca una identidad Google mediante
 * el identificador estable "sub".
 */
export const findGoogleIdentity = async (googleId: string) => {
  const { data, error } = await supabase
    .from("usuario_identidades")
    .select(
      `
      id_identidad,
      id_usuario,
      proveedor,
      proveedor_usuario_id,
      email_proveedor
    `,
    )
    .eq("proveedor", "GOOGLE")
    .eq("proveedor_usuario_id", googleId)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando identidad Google: ${error.message}`);
  }

  return data;
};

/**
 * Comprueba si ese email ya pertenece
 * a una cuenta local.
 */
export const findUserByGoogleEmail = async (email: string) => {
  const { data, error } = await supabase
    .from("usuarios")
    .select(
      `
        id_usuario,
        nombre_usuario,
        email,
        password_hash,
        email_verificado,
        activo,
        id_rol
      `,
    )
    .ilike("email", literalLikePattern(email))
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando usuario por email: ${error.message}`);
  }

  return data;
};

export const markGoogleEmailAsVerified = async (idUsuario: string) => {
  const { error } = await supabase
    .from("usuarios")
    .update({ email_verificado: true })
    .eq("id_usuario", idUsuario);

  if (error) {
    throw new Error(`Error verificando correo de Google: ${error.message}`);
  }
};

interface CreateGoogleUserData {
  idRol: string;
  username: string;
  email: string;
}

/**
 * Crea una cuenta sin contraseña local.
 */
export const createGoogleUser = async (data: CreateGoogleUserData) => {
  const { data: user, error } = await supabase
    .from("usuarios")
    .insert({
      id_rol: data.idRol,
      nombre_usuario: data.username,
      email: data.email,

      // Cuenta exclusivamente Google.
      password_hash: null,

      // Google ya verificó el email.
      email_verificado: true,
    })
    .select(
      `
        id_usuario,
        id_rol,
        nombre_usuario,
        email,
        email_verificado,
        activo
      `,
    )
    .single();

  if (error) {
    throw error;
  }

  return user;
};

interface CreateGoogleIdentityData {
  idUsuario: string;
  googleId: string;
  email: string;
}

/**
 * Relaciona nuestro usuario con
 * la identidad estable de Google.
 */
export const createGoogleIdentity = async (data: CreateGoogleIdentityData) => {
  const { error } = await supabase.from("usuario_identidades").insert({
    id_usuario: data.idUsuario,

    proveedor: "GOOGLE",

    proveedor_usuario_id: data.googleId,

    email_proveedor: data.email,
  });

  if (error) {
    throw new Error(`Error guardando identidad Google: ${error.message}`);
  }
};
