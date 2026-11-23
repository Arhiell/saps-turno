import type {
  Request,
  Response,
  NextFunction
} from "express";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/password-recovery.validator.js";

import {
  requestPasswordRecovery,
  resetPassword
} from "../services/password-recovery.service.js";



// POST /api/auth/password/forgot
export const forgotPassword = async (
  req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = forgotPasswordSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Datos de recuperación inválidos",
          errors: validation.error.flatten().fieldErrors,
        });
      }

      await requestPasswordRecovery(validation.data, {
        ip: req.ip ?? null,
      });

      /**
       * Nunca informamos si el email
       * existe o no.
       */
      const response: {
        success: boolean;
        message: string;
      } = {
        success: true,
        message:
          "Si el correo está registrado, recibirás un código para recuperar la contraseña",
      };


      return res.status(200).json(response);
    } catch (error) {
      next(error);
    }
};

// POST /api/auth/password/reset
export const resetUserPassword = async (
  req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = resetPasswordSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Datos de recuperación inválidos",
          errors: validation.error.flatten().fieldErrors,
        });
      }

      await resetPassword(validation.data);

      return res.status(200).json({
        success: true,
        message: "Contraseña actualizada correctamente",
      });
    } catch (error) {
      next(error);
    }
};
