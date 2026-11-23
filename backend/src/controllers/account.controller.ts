import type { RequestHandler } from 'express';

import {
  changeOwnUsername,
  changeOwnPassword,
} from '../services/account.service.js';

// Actualiza el nombre de usuario de la cuenta autenticada.
export const changeUsername: RequestHandler = async (
  req,
  res
) => {
  await changeOwnUsername(
    req.body,
    req.user!
  );

  res.json({
    success: true,
    message: 'Nombre de usuario actualizado.',
  });
};

// Actualiza la contraseña de la cuenta autenticada.
export const changePassword: RequestHandler = async (
  req,
  res
) => {
  await changeOwnPassword(
    req.body,
    req.user!
  );

  res.json({
    success: true,
    message: 'Contraseña actualizada. Volvé a ingresar.',
  });
};