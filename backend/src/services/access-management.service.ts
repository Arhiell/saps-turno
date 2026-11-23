import { supabase } from '../config/supabase.js';

import type { AuthenticatedUser } from '../types/auth.types.js';

import { getTurnoScope } from './turno-access.service.js';
import { agendaDateTime } from '../utils/turno-time.js';
import { AppError } from '../utils/app-error.js';
import { personSelect } from '../repositories/person-read.repository.js';
import { editPerson } from './person.service.js';
import { updatePersonSchema } from '../validators/person.validator.js';
import { revokeAllUserRefreshSessions } from '../repositories/sesion.repository.js';
import { literalLikePattern } from '../utils/like-pattern.js';

// Define los filtros para consultar las cuentas administrativas y de recepción.
export interface AdminFilters {
  page: number;
  search: string;
  role?: 'SUPER_ADMIN' | 'ADMIN_SALITA' | 'RECEPCION';
  clinic?: string;
}

// Obtiene las cuentas administrativas y de recepción según el alcance del usuario.
export async function listManagedRecords(
  user: AuthenticatedUser,
  filters: AdminFilters
) {
  const { page, search, role, clinic } = filters;

  // Obtiene las salitas que el usuario tiene permitido administrar.
  const scope = await getTurnoScope(user);

  const empty = {
    items: [],
    total: 0,
    page,
    totalPages: 0,
  };

  // Evita consultar cuentas fuera del alcance autorizado.
  if (
    scope !== null &&
    (!scope.length || role === 'SUPER_ADMIN')
  ) {
    return empty;
  }

  // Verifica que la salita solicitada pertenezca al alcance del usuario.
  if (
    scope !== null &&
    clinic &&
    !scope.includes(clinic)
  ) {
    throw new AppError(
      'La sala no pertenece a tu alcance.',
      403
    );
  }

  // Obtiene la fecha actual para validar las asignaciones vigentes.
  const today = agendaDateTime(new Date()).date;

  const inner = scope !== null || clinic ? '!inner' : '';

  // Construye la consulta de cuentas y sus relaciones.
  let query = supabase
    .from('usuarios')
    .select(
      `id_usuario, id_persona, nombre_usuario, email, activo, email_verificado,
      rol:roles!inner(codigo, nombre), persona:personas(${personSelect}),
      asignaciones:usuario_salita${inner}(id_salita, salita:salitas(id_salita, nombre))`,
      {
        count: 'exact',
      }
    )
    .in(
      'rol.codigo',
      scope !== null
        ? ['ADMIN_SALITA', 'RECEPCION']
        : ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION']
    )
    .eq('asignaciones.activo', true)
    .lte('asignaciones.fecha_desde', today)
    .or(
      `fecha_hasta.is.null,fecha_hasta.gte.${today}`,
      {
        referencedTable: 'asignaciones',
      }
    );

  // Filtra las cuentas por rol administrativo o de recepción.
  if (role) {
    query = query.eq('rol.codigo', role);
  }

  // Filtra por salita o por las salitas autorizadas.
  if (clinic) {
    query = query.eq('asignaciones.id_salita', clinic);
  } else if (scope !== null) {
    query = query.in('asignaciones.id_salita', scope);
  }

  // Aplica la búsqueda por nombre de usuario o correo electrónico.
  if (search) {
    const pattern = JSON.stringify(
      '%' + literalLikePattern(search) + '%'
    );

    query = query.or(
      `nombre_usuario.ilike.${pattern},email.ilike.${pattern}`
    );
  }

  // Ordena y pagina los resultados.
  const { data, count, error } = await query
    .order('fecha_creacion', {
      ascending: false,
    })
    .order('id_usuario')
    .range(
      (page - 1) * 20,
      page * 20 - 1
    );

  if (error) {
    throw error;
  }

  // Devuelve las cuentas junto con la información de paginación.
  return {
    items: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / 20),
  };
}

// Permite corregir los datos personales de una cuenta administrativa o de recepción.
export async function correctManagedPerson(
  user: AuthenticatedUser,
  id: string,
  body: unknown
) {
  // Restringe la modificación al superadministrador.
  if (user.rol !== 'SUPER_ADMIN') {
    throw new AppError(
      'Solo el superadministrador puede modificar administradores.',
      403
    );
  }

  // Verifica que la persona tenga una cuenta administrativa o de recepción.
  const { data, error } = await supabase
    .from('usuarios')
    .select(
      'id_usuario, rol:roles!inner(codigo)'
    )
    .eq('id_persona', id)
    .in('rol.codigo', [
      'SUPER_ADMIN',
      'ADMIN_SALITA',
      'RECEPCION',
    ])
    .limit(1);

  if (error) {
    throw error;
  }

  if (!data?.length) {
    throw new AppError(
      'No se encontró una cuenta administrativa para esta persona.',
      404
    );
  }

  // Valida los campos permitidos y excluye el correo electrónico.
  const input = updatePersonSchema
    .omit({
      email: true,
    })
    .strict()
    .parse(body);

  // Actualiza los datos personales.
  return editPerson(id, input);
}

// Activa o desactiva el acceso de una cuenta administrativa o de recepción.
export async function changeManagedAccess(
  user: AuthenticatedUser,
  id: string,
  active: boolean
) {
  // Restringe la gestión de cuentas al superadministrador.
  if (user.rol !== 'SUPER_ADMIN') {
    throw new AppError(
      'Solo el superadministrador puede gestionar estas cuentas.',
      403
    );
  }

  // Impide modificar el estado de la propia cuenta.
  if (id === user.id_usuario) {
    throw new AppError(
      'No podés cambiar el estado de tu propia cuenta.',
      409
    );
  }

  // Busca la cuenta administrativa o de recepción que se desea modificar.
  const { data: target, error } = await supabase
    .from('usuarios')
    .select(
      'id_usuario, id_persona, id_rol, rol:roles!inner(codigo)'
    )
    .eq('id_usuario', id)
    .single();

  if (error || !target) {
    if (error?.code === 'PGRST116') {
      throw new AppError(
        'Cuenta no encontrada.',
        404
      );
    }

    throw error ?? new AppError(
      'Cuenta no encontrada.',
      404
    );
  }

  // Obtiene el rol de la cuenta seleccionada.
  const role = (
    target.rol as unknown as { codigo: string }
  ).codigo;

  // Verifica que la cuenta pertenezca a un rol administrativo o de recepción.
  if (
    !['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'].includes(role)
  ) {
    throw new AppError(
      'Esta sección solo administra cuentas administrativas.',
      403
    );
  }

  // Evita desactivar al último superadministrador activo.
  if (!active && role === 'SUPER_ADMIN') {
    const {
      count,
      error: countError,
    } = await supabase
      .from('usuarios')
      .select('id_usuario', {
        count: 'exact',
        head: true,
      })
      .eq('id_rol', target.id_rol)
      .eq('activo', true);

    if (countError) {
      throw countError;
    }

    if ((count ?? 0) <= 1) {
      throw new AppError(
        'Debe quedar al menos un superadministrador activo.',
        409
      );
    }
  }

  // Revoca las sesiones anteriores antes de cambiar el estado.
  await revokeAllUserRefreshSessions(id);

  // Actualiza el acceso de la cuenta administrativa.
  const { error: updateError } = await supabase
    .from('usuarios')
    .update({
      activo: active,
    })
    .eq('id_usuario', id);

  if (updateError) {
    throw updateError;
  }
}
