import type {
  Request,
  Response,
  NextFunction
} from "express";

import {
  createTutorSchema
} from "../validators/tutor.validator.js";

import {
  registerTutor
} from "../services/tutor.service.js";

/**
 * POST /api/tutors
 */
export const createTutorController = async (req: Request,
  res: Response, next: NextFunction) => {
    try {
      const validation = createTutorSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Datos del tutor inválidos",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const tutor = await registerTutor(validation.data);

    return res.status(201).json({
      success: true,
      message: "Tutor registrado correctamente",
      data: {
        tutor,
      },
    });
  } catch (error) {
    next(error);
  }
};
