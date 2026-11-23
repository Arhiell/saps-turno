import type {
  Request,
  Response,
  NextFunction,
} from 'express';

import { isAdministrativeRole } from '../services/admin-profile.service.js';
import { verifyAccessToken } from '../services/jwt.service.js';

import {
  findUserById,
  findRoleById,
} from '../repositories/user.repository.js';

import { AppError } from '../utils/app-error.js';
import { assertAccountAccess } from '../services/account-access.service.js';

// Valida el token y carga el usuario autenticado en req.user.
const authenticateRequest = (allowIncompleteProfile: boolean) => async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Obtiene el token del encabezado Authorization.
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new AppError('Token de acceso requerido', 401);
    }

    const token = authorization.substring(7);

    // Verifica el token de acceso.
    const payload = await verifyAccessToken(token);

    if (!payload.sub) {
      throw new AppError('Token inválido', 401);
    }

    // Comprueba que el usuario exista y esté activo.
    const user = await findUserById(payload.sub);

    if (!user) {
      throw new AppError('Usuario no autorizado', 401);
    }
    assertAccountAccess(user);

    // Verifica que el rol del usuario esté activo.
    const role = await findRoleById(user.id_rol);

    if (!role || !role.activo) {
      throw new AppError('Rol inválido', 403);
    }

    // Almacena los datos del usuario autenticado.
    req.user = {
      id_usuario: user.id_usuario,
      email: user.email,
      nombre_usuario: user.nombre_usuario,
      rol: role.codigo,
      id_rol: role.id_rol,
      id_persona: user.id_persona,
      email_verificado: user.email_verificado,
      perfil_completo: Boolean(user.id_persona),
    };

    // Aplica las restricciones para roles administrativos.
    if (isAdministrativeRole(role.codigo)) {
      // Exige que el correo electrónico esté verificado.
      if (!user.email_verificado) {
        throw new AppError(
          'Verificá tu correo antes de continuar.',
          403,
          'EMAIL_NOT_VERIFIED'
        );
      }

      // Exige el perfil completo cuando corresponda.
      if (!allowIncompleteProfile && !user.id_persona) {
        throw new AppError(
          'Completá tus datos personales antes de continuar.',
          403,
          'PROFILE_INCOMPLETE'
        );
      }
    }

    // Continúa con el siguiente middleware.
    next();
  } catch (error) {
    // Propaga los errores controlados.
    if (error instanceof AppError) {
      return next(error);
    }

    return next(new AppError('Token inválido o vencido', 401));
  }
};

// Exige autenticación y perfil completo para roles administrativos.
export const authenticate = authenticateRequest(false);

// Permite acceder sin perfil completo para completar los datos personales.
export const authenticateForProfile = authenticateRequest(true);
