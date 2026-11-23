import type { RequestHandler } from 'express';
import { z } from 'zod';
import {
  createTutorRequestSchema,
  resolveTutorRequestSchema,
} from '../validators/tutor-request.validator.js';
import {
  getAdminTutorRequests,
  getOwnTutorRequests,
  requestTutorLink,
  resolveTutorRequest,
} from '../services/tutor-request.service.js';

const requestIdSchema = z.string().uuid();

export const createTutorRequestController: RequestHandler = async (req, res, next) => {
  try {
    const input = createTutorRequestSchema.parse(req.body);
    const request = await requestTutorLink(req.user!, input);
    res.status(201).json({
      success: true,
      message: 'Solicitud registrada. La autorización se habilitará únicamente después de la verificación presencial y aprobación de la salita.',
      data: { request },
    });
  } catch (error) { next(error); }
};

export const listOwnTutorRequestsController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ success: true, data: { requests: await getOwnTutorRequests(req.user!) } });
  } catch (error) { next(error); }
};

export const listAdminTutorRequestsController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ success: true, data: { requests: await getAdminTutorRequests(req.user!) } });
  } catch (error) { next(error); }
};

export const resolveTutorRequestController: RequestHandler = async (req, res, next) => {
  try {
    const requestId = requestIdSchema.parse(req.params.requestId);
    const input = resolveTutorRequestSchema.parse(req.body);
    const result = await resolveTutorRequest(req.user!, requestId, input);
    res.json({
      success: true,
      message: input.accion === 'APROBAR' ? 'Vínculo aprobado y habilitado.' : 'Solicitud rechazada.',
      data: { result },
    });
  } catch (error) { next(error); }
};
