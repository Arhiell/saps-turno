import {
  createUser,
  findRoleByCode,
  findUserByEmail
} from "../repositories/user.repository.js";

import {
  hashPassword
} from "../services/password.service.js";

import {
  createVerificationCodeForNewUser
} from "../services/email-verification.service.js";


/**
 * Credenciales recibidas solo desde
 * variables locales de entorno.
 */
const username =
  process.env.SUPER_ADMIN_USERNAME;

const email =
  process.env.SUPER_ADMIN_EMAIL;

const password =
  process.env.SUPER_ADMIN_PASSWORD;

if (!username || !email || !password) {
  throw new Error(
    "Faltan las variables del Super Admin"
  );
}

const existing =
  await findUserByEmail(email);

if (existing) {
  throw new Error(
    "El Super Admin ya existe"
  );
}

const role =
  await findRoleByCode("SUPER_ADMIN");

if (!role) {
  throw new Error(
    "Rol SUPER_ADMIN no encontrado"
  );
}

const passwordHash =
  await hashPassword(password);

const user = await createUser({
  id_rol: role.id_rol,
  nombre_usuario: username,
  email: email.toLowerCase(),
  password_hash: passwordHash
});

await createVerificationCodeForNewUser(
  user.id_usuario,
  user.email,
  null
);

console.log(
  "Super Admin creado. Se envió un código de verificación a:",
  user.email
);