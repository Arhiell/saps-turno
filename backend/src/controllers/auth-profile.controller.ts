import type {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  completeAdminProfile,
  isAdministrativeRole,
} from '../services/admin-profile.service.js';

import { completePersonSchema } from '../validators/person.validator.js';
import { editOwnProfile } from '../services/own-person.service.js';

import {
  getOwnProfile,
  completeOwnProfile,
} from '../services/auth-profile.service.js';

// Actualiza los datos permitidos del usuario autenticado.
export const updateOwnProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Actualiza el perfil según los permisos del rol.
    await editOwnProfile(req.body, req.user!);

    // Devuelve el perfil actualizado.
    res.json({
      success: true,
      data: await getOwnProfile(req.user!),
    });
  } catch (error) {
    next(error);
  }
};

// Obtiene el perfil del usuario autenticado.
export const ownProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.json({
      success: true,
      data: await getOwnProfile(req.user!),
    });
  } catch (error) {
    next(error);
  }
};

// Completa por primera vez el perfil del usuario autenticado.
export const completeProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user!;

    // Completa el perfil si el usuario tiene un rol administrativo.
    if (isAdministrativeRole(user.rol)) {
      await completeAdminProfile(
        completePersonSchema.parse(req.body),
        user,
        req.ip ?? null
      );
    }

    // Obtiene o completa el perfil según el rol.
    const profile = isAdministrativeRole(user.rol)
      ? await getOwnProfile(user)
      : await completeOwnProfile(req.body, user);

    // Devuelve el perfil completado.
    res.status(201).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};