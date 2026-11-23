import express, { Router, type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { chatbotController } from '../controllers/chatbot.controller.js';
import { CHATBOT_ROLES } from '../config/chatbot.config.js';
import { AppError } from '../utils/app-error.js';

// No se envían objetos originales al manejador global, que registra errores en consola.
export const chatbotErrorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  res.set('Cache-Control', 'no-store');
  if (error instanceof AppError) {
    if (error.statusCode === 429) res.set('Retry-After', String(error.data?.retryAfter ?? 60));
    res.status(error.statusCode).json({ success: false, message: error.message,
      ...(error.code ? { code: error.code } : {}) });
    return;
  }
  const parseError = error as { type?: string } | null;
  if (parseError?.type === 'entity.too.large') {
    res.status(413).json({ success: false, message: 'La consulta supera el tamaño permitido.', code: 'CHATBOT_BODY_TOO_LARGE' });
    return;
  }
  if (error instanceof ZodError || parseError?.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, message: 'Enviá únicamente un mensaje de entre 1 y 1000 caracteres.', code: 'CHATBOT_INVALID_REQUEST' });
    return;
  }
  res.status(500).json({ success: false, message: 'El asistente no está disponible en este momento.', code: 'CHATBOT_ERROR' });
};

// Se monta antes del parser global, únicamente en la ruta del chatbot.
export const chatbotBodyParser = Router();
chatbotBodyParser.use(express.json({ limit: '8kb' }));
chatbotBodyParser.use(chatbotErrorHandler);

const router = Router();
router.post('/', authenticate, requireRole(...CHATBOT_ROLES), chatbotController);
router.use(chatbotErrorHandler);
export default router;
