import type {
  RequestHandler
} from "express";

import {
  tutorIdSchema,
  tutorDniSchema,
  tutorListQuerySchema,
} from "../validators/tutor-query.validator.js";

import {
  getTutors,
  getTutorById,
  getTutorByDni
} from "../services/tutor-read.service.js";

// Valida la paginación y devuelve los tutores activos.
export const listTutorsController: RequestHandler = async (req, res, next) => {
  const parsed = tutorListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Paginacion invalida",
    });
    return;
  }
  try {
    res.json({
      success: true,
      data: await getTutors(parsed.data),
    });
  } catch (error) {
    next(error);
  }
};
// La consulta individual también permite revisar tutores inactivos.
export const getTutorController: RequestHandler = async (req, res, next) => {
  const parsed = tutorIdSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "UUID invalido",
    });
    return;
  }
  try {
    res.json({
      success: true,
      data: {
        tutor: await getTutorById(parsed.data.id),
      },
    });
  } catch (error) {
    next(error);
  }
};
// Resuelve la identidad por DNI sin exigir otra consulta al frontend.
export const getTutorByDniController: RequestHandler = async (req, res, next) => {
  const parsed = tutorDniSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "DNI invalido" });
    return;
  }
  try {
    res.json({ success: true, data: { tutor: await getTutorByDni(parsed.data.dni) } });
  } catch (error) {
    next(error);
  }
};
