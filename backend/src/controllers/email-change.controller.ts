import type {
  RequestHandler,
} from 'express';

import {
  requestEmailVerificationSchema,
  verifyEmailCodeSchema,
} from '../validators/email-verification.validators.js';

import {
  requestEmailChange,
  confirmEmailChange,
} from '../services/email-change.service.js';

// Solicita el cambio de correo electrónico del usuario autenticado.
export const requestChange: RequestHandler = async (
  req,
  res
) => {
  // Valida el nuevo correo recibido.
  const {
    email,
  } = requestEmailVerificationSchema.parse(
    req.body
  );

  // Solicita el cambio y devuelve la información generada.
  res.json({
    success: true,
    data: await requestEmailChange(
      email,
      req.user!,
      req.ip ?? null
    ),
  });
};

// Confirma el cambio de correo mediante el código recibido.
export const confirmChange: RequestHandler = async (
  req,
  res
) => {
  // Valida el correo y el código de verificación.
  const {
    email,
    code,
  } = verifyEmailCodeSchema.parse(
    req.body
  );

  // Confirma el cambio para el usuario autenticado.
  await confirmEmailChange(
    email,
    code,
    req.user!
  );

  res.json({
    success: true,
    message: 'Correo actualizado correctamente.',
  });
};