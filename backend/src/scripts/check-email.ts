import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { supabase } from "../config/supabase.js";

// Diagnóstico sin enviar correos ni mostrar credenciales o datos de usuarios.
const { error } = await supabase
  .from("tokens_verificacion_email")
  .select("intentos,nuevo_email,email_anterior")
  .limit(0);

if (error) {
  console.error("Base de datos: no se pudo comprobar tokens_verificacion_email (intentos, nuevo_email, email_anterior).");
  console.error("Código de error:", error.code || "sin código");
  if (error.code === "42703" || error.code === "PGRST204") {
    console.error("Aplicá src/BBDD/20260929_patient_email_change.sql en el SQL Editor del proyecto de Supabase configurado en backend/.env.");
  } else {
    console.error("Revisá la conexión, los permisos y el proyecto de Supabase configurado.");
  }
  process.exitCode = 1;
} else {
  console.log("Base de datos: columnas intentos, nuevo_email y email_anterior disponibles.");
}

const transporter = nodemailer.createTransport({
  host: env.MAIL_HOST,
  port: env.MAIL_PORT,
  secure: env.MAIL_SECURE,
  auth: { user: env.MAIL_USER, pass: env.MAIL_PASSWORD },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

try {
  await transporter.verify();
  console.log("SMTP: conexión y autenticación correctas (no se envió ningún correo).");
} catch (cause) {
  const error = cause as { code?: string; command?: string };
  console.error("SMTP: falló la comprobación.", error.code ?? "", error.command ?? "");
  process.exitCode = 1;
} finally {
  transporter.close();
}
