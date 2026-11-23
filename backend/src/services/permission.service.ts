import {
  findRoleWithPermissions,
  type RolePermissionLookup,
  type RolePermissionRecord,
} from '../repositories/permission.repository.js';
import type { RolePermissionsData } from '../types/permission.types.js';
import { AppError } from '../utils/app-error.js';

interface CachedRolePermissions extends RolePermissionsData {
  expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 30_000;

let cacheTtlMs = DEFAULT_CACHE_TTL_MS;
const rolePermissionCache = new Map<string, CachedRolePermissions>();
const inFlightLookups = new Map<string, Promise<RolePermissionRecord | null>>();

const buildCacheKey = (lookup: RolePermissionLookup): string =>
  lookup.idRol ? `id:${lookup.idRol}` : `code:${lookup.codigo}`;

/**
 * Permite ajustar el TTL de la caché de permisos (en ms).
 * Un valor de 0 desactiva la caché entre consultas.
 */
export const setPermissionCacheTtlMs = (ttlMs: number): void => {
  cacheTtlMs = Math.max(0, Math.floor(ttlMs));
};

export const getPermissionCacheTtlMs = (): number => cacheTtlMs;

/**
 * Invalida la caché de permisos de todos los roles o de un rol específico.
 * Debe invocarse cuando se modifiquen roles, permisos o asignaciones en rol_permisos.
 */
export const invalidatePermissionCache = (target?: {
  idRol?: string;
  codigo?: string;
}): void => {
  if (!target) {
    rolePermissionCache.clear();
    inFlightLookups.clear();
    return;
  }

  for (const [key, entry] of rolePermissionCache.entries()) {
    if (
      (target.idRol && entry.idRol === target.idRol) ||
      (target.codigo && entry.codigo === target.codigo)
    ) {
      rolePermissionCache.delete(key);
    }
  }

  if (target.idRol) {
    inFlightLookups.delete(`id:${target.idRol}`);
  }
  if (target.codigo) {
    inFlightLookups.delete(`code:${target.codigo}`);
  }
};

const toRolePermissionsData = (
  record: RolePermissionRecord
): RolePermissionsData => ({
  idRol: record.id_rol,
  codigo: record.codigo,
  activo: record.activo,
  permissions: new Set(record.permisos),
});

/**
 * Resuelve el rol y sus permisos activos desde caché vigente o PostgreSQL.
 * Solo cachea roles activos; errores de base de datos nunca se ocultan ni cachean.
 */
export const getRolePermissions = async (
  lookup: RolePermissionLookup
): Promise<RolePermissionsData | null> => {
  const cacheKey = buildCacheKey(lookup);
  const now = Date.now();

  if (cacheTtlMs > 0) {
    const cached = rolePermissionCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return {
        idRol: cached.idRol,
        codigo: cached.codigo,
        activo: cached.activo,
        permissions: new Set(cached.permissions),
      };
    }

    if (cached) {
      rolePermissionCache.delete(cacheKey);
    }
  }

  let pending = inFlightLookups.get(cacheKey);
  if (!pending) {
    pending = findRoleWithPermissions(lookup).finally(() => {
      inFlightLookups.delete(cacheKey);
    });
    inFlightLookups.set(cacheKey, pending);
  }

  const record = await pending;
  if (!record) {
    return null;
  }

  const resolved = toRolePermissionsData(record);

  if (cacheTtlMs > 0 && resolved.activo) {
    rolePermissionCache.set(cacheKey, {
      ...resolved,
      permissions: new Set(resolved.permissions),
      expiresAt: Date.now() + cacheTtlMs,
    });
  }

  return resolved;
};

/**
 * Verifica que el rol del usuario autenticado siga activo y posea todos los
 * permisos requeridos (y activos) en la base de datos.
 */
export const assertRoleHasPermissions = async (
  roleContext: { idRol?: string; codigo: string },
  requiredPermissions: readonly string[]
): Promise<RolePermissionsData> => {
  if (
    !roleContext.codigo ||
    requiredPermissions.length === 0 ||
    requiredPermissions.some(
      (permiso) => typeof permiso !== 'string' || permiso.trim().length === 0
    )
  ) {
    throw new AppError('No tiene permisos para realizar esta acción', 403);
  }

  const normalizedPermissions = Array.from(
    new Set(requiredPermissions.map((permiso) => permiso.trim()))
  );

  const roleData = await getRolePermissions({
    ...(roleContext.idRol ? { idRol: roleContext.idRol } : {}),
    codigo: roleContext.codigo,
  });

  if (!roleData || !roleData.activo) {
    throw new AppError('Rol inválido o inactivo', 403);
  }

  if (roleData.codigo !== roleContext.codigo) {
    throw new AppError('Rol inválido', 403);
  }

  const hasAllPermissions = normalizedPermissions.every((permiso) =>
    roleData.permissions.has(permiso)
  );

  if (!hasAllPermissions) {
    throw new AppError('No tiene permisos para realizar esta acción', 403);
  }

  return roleData;
};
