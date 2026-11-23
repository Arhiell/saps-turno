import { supabase } from '../config/supabase.js';

interface PermisoJoinRow {
  codigo: string;
  activo: boolean;
}

interface RolPermisoJoinRow {
  permiso: PermisoJoinRow | PermisoJoinRow[] | null;
}

interface RoleWithPermissionsRow {
  id_rol: string;
  codigo: string;
  activo: boolean;
  rol_permisos: RolPermisoJoinRow[] | null;
}

export interface RolePermissionRecord {
  id_rol: string;
  codigo: string;
  activo: boolean;
  permisos: string[];
}

export interface RolePermissionLookup {
  idRol?: string;
  codigo: string;
}

/**
 * Consulta en PostgreSQL el rol autenticado junto con sus permisos activos
 * a través de la relación roles -> rol_permisos -> permisos.
 */
export const findRoleWithPermissions = async (
  lookup: RolePermissionLookup
): Promise<RolePermissionRecord | null> => {
  let query = supabase
    .from('roles')
    .select(
      'id_rol, codigo, activo, rol_permisos(permiso:permisos(codigo, activo))'
    );

  if (lookup.idRol) {
    query = query.eq('id_rol', lookup.idRol);
  } else {
    query = query.eq('codigo', lookup.codigo);
  }

  const { data, error } = await query.maybeSingle<RoleWithPermissionsRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const activePermissions: string[] = [];

  for (const relation of data.rol_permisos ?? []) {
    const entries = Array.isArray(relation.permiso)
      ? relation.permiso
      : relation.permiso
        ? [relation.permiso]
        : [];

    for (const permiso of entries) {
      if (permiso.activo === true && typeof permiso.codigo === 'string') {
        activePermissions.push(permiso.codigo);
      }
    }
  }

  return {
    id_rol: data.id_rol,
    codigo: data.codigo,
    activo: data.activo,
    permisos: activePermissions,
  };
};
