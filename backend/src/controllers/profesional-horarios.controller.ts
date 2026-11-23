import type { RequestHandler } from 'express';
import { getMisHorariosYDisponibilidad } from '../services/profesional-horarios.service.js';

export const obtenerMisHorariosController: RequestHandler = async (req, res, next) => {
  try {
    const fecha = typeof req.query.fecha === 'string' ? req.query.fecha : undefined;
    const data = await getMisHorariosYDisponibilidad(req.user!, fecha);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
