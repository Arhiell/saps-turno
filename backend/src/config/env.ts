import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  // Prototipo funcional optativo: nunca exige credenciales para iniciar CORA.
  CHATBOT_ENABLED: z.string().optional().transform(value => value === 'true'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash-lite'),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(3000),

  SUPABASE_URL: z
    .string()
    .url("SUPABASE_URL debe ser una URL válida"),

  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "Falta SUPABASE_PUBLISHABLE_KEY"),

  SUPABASE_SECRET_KEY: z
    .string()
    .min(1, "Falta SUPABASE_SECRET_KEY"),

  SUPABASE_JWKS_URL: z
    .string()
    .url()
    .optional(),

  // Clave utilizada para formar nuestrar JWT.
  JWT_ACCESS_SECRET: z.string().min(12),

  //Tiempo de expiración del JWT en segundos.
  JWT_ACCESS_EXPIRES_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10),

  //Cantidad máxima de intentos incorrectos antes de bloquear temporalmente la cuenta.
  LOGIN_MAX_ATTEMPTS: z.coerce
    .number()
    .int()
    .positive()
    .default(5),

  //Duración del bloqueo temporal.
  LOGIN_LOCK_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(15),

  // Cantidad de días que permanece
  // valida una sesión refresh.
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .default(7),

  // Minutos durante los cuales será válido un
  // token de recuperación de contraseña.
  PASSWORD_RECOVERY_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(15),

  /**
  * Horas durante las cuales será válido
  * un token de verificación de correo.
  */
  EMAIL_VERIFICATION_HOURS: z.coerce
   .number()
    .int()
    .positive()
    .default(24),

  /**
   *  Client ID utilizado por Google Identity Services.
   * El backend comprobará que los ID Tokens
   * hayan sido emitidos para nuestra aplicación.
   * */
  GOOGLE_CLIENT_ID: z
    .string()
    .min(1, "Falta GOOGLE_CLIENT_ID"),

    MAIL_HOST: z.string().min(1),
    MAIL_PORT: z.coerce.number().int().positive(),
    MAIL_SECURE: z
      .string()
      .transform((value) => value === "true"),
    MAIL_USER: z.string().email(),
    MAIL_PASSWORD: z.string().min(1),
    MAIL_FROM_NAME: z.string().min(1),
    MAIL_FROM_EMAIL: z.string().email(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error(" Error en las variables de entorno:");

  console.error(
    result.error.flatten().fieldErrors
  );

  throw new Error(
    "Configuración de variables de entorno inválida"
  );


}

export const env = result.data;
