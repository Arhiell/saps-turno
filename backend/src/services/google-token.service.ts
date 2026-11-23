import {
  OAuth2Client
} from "google-auth-library";

import {
  env
} from "../config/env.js";

import {
  AppError
} from "../utils/app-error.js";

/**
 * Cliente encargado exclusivamente
 * de verificar tokens de Google.
 */
const googleClient =
  new OAuth2Client();

/**
 * Datos de Google que realmente
 * necesitamos dentro de SAPS Turno.
 */
export interface VerifiedGoogleUser {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/**
 * Verifica firma, audiencia,
 * vencimiento y emisor del ID Token.
 */
export const verifyGoogleCredential =
  async (
    credential: string
  ): Promise<VerifiedGoogleUser> => {
    try {
      const ticket =
        await googleClient.verifyIdToken({
          idToken: credential,
          audience:
            env.GOOGLE_CLIENT_ID
        });

      const payload =
        ticket.getPayload();

      if (!payload) {
        throw new AppError(
          "Credencial de Google inválida",
          401
        );
      }

      /**
       * "sub" es el identificador estable
       * de la cuenta Google.
       */
      if (
        !payload.sub ||
        !payload.email
      ) {
        throw new AppError(
          "La cuenta de Google no contiene la información requerida",
          401
        );
      }

      /**
       * No aceptamos cuentas cuyo email
       * Google no haya verificado.
       */
      if (!payload.email_verified) {
        throw new AppError(
          "El correo de Google no está verificado",
          401
        );
      }

      return {
        googleId: payload.sub,
        email:
          payload.email.toLowerCase(),
        emailVerified:
          payload.email_verified,
        name:
          payload.name ?? null
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "Credencial de Google inválida o vencida",
        401
      );
    }
  };