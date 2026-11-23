import type {
  Request,
  Response,
  NextFunction
} from "express";

import {
  googleLoginSchema
} from "../validators/google-auth.validator.js";

import {
  loginWithGoogle
} from "../services/google-auth.service.js";

/**
 * POST /api/auth/google
 *
 * Registro o login mediante Google.
 */
export const googleLogin = async (
  req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = googleLoginSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Credencial de Google inválida",
          errors: validation.error.flatten().fieldErrors,
        });
      }

      const result = await loginWithGoogle(validation.data, {
        ip: req.ip ?? null,

        userAgent: req.get("user-agent") ?? null,
      });

      return res.status(200).json({
        success: true,
        message: "Inicio de sesión con Google correcto",
        data: result,
      });
    } catch (error) {
      next(error);
    }
};
