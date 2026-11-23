
import {
  findCierre,
  findCierres,
  findProfesionalesCierre,
  saveCierre,
  getCierresPendientes,
} from '../repositories/cierre-calendario.repository.js';

import {
  cierreSchema,
  type Cierre,
} from '../validators/cierre-calendario.validator.js';

import { assertNoAgendaAffected } from './agenda-impacto.service.js';

import {
  authorizeCierre,
  cierreScope,
  assertCierreScope,
} from './cierre-access.service.js';

import { emitirHorarioAtencionActualizado } from './socket.service.js';
import { AppError } from '../utils/app-error.js';

import type { AuthenticatedUser } from '../types/auth.types.js';

// Obtiene los cierres institucionales y sus turnos pendientes.
export const listCierres = async (
  user: AuthenticatedUser
) => {
  // Obtiene las salitas autorizadas para el usuario.
  const scope = await cierreScope(user);

  // Consulta los cierres y sus pendientes de forma simultánea.
  const [rows, pendientes] = await Promise.all([
    findCierres(scope),
    getCierresPendientes(scope),
  ]);

  // Incorpora información adicional a cada cierre.
  return rows.map((row) => ({
    ...row,

    // Cantidad de turnos pendientes asociados al cierre.
    turnos_pendientes:
      pendientes.find(
        (p) => p.id_cierre === row.id_cierre
      )?.cantidad ?? 0,

    // Identifica cierres manuales que coinciden con feriados importados.
    coincidencias_manuales: row.fuente_externa
      ? rows
          .filter(
            (c) =>
              !c.fuente_externa &&
              c.activo &&
              c.tipo === 'FERIADO_NACIONAL' &&
              c.alcance === 'GLOBAL' &&
              c.dia_completo &&
              c.fecha_inicio === row.fecha_inicio &&
              c.fecha_fin === row.fecha_fin
          )
          .map((c) => c.id_cierre)
      : [],
  }));
};

// Notifica a los profesionales sobre cambios en el calendario institucional.
export const notificarCalendario = async (
  scope: string[] | null
) => {
  // Obtiene los profesionales asociados a las salitas correspondientes.
  for (const id of await findProfesionalesCierre(scope)) {
    emitirHorarioAtencionActualizado({
      id_profesional: id,
      mensaje:
        'Se actualizó el calendario institucional. Revisá la disponibilidad de tu agenda.',
    });
  }
};

// Notifica los cambios de agenda después de guardar un cierre.
const notifyAgenda = async (
  current: Cierre | null,
  saved: Cierre
) => {
  try {
    // Reúne la configuración anterior y la nueva.
    const rows = [current, saved].filter(
      (c): c is Cierre => c !== null
    );

    // Determina si la notificación es global o por salitas.
    const scope = rows.some(
      (c) => c.alcance === 'GLOBAL'
    )
      ? null
      : [
          ...new Set(
            rows.map((c) => c.id_salita!)
          ),
        ];

    await notificarCalendario(scope);
  } catch (error) {
    // La notificación en vivo no revierte una escritura ya confirmada.
    console.error(
      'No se pudo avisar el cambio de calendario institucional:',
      error
    );
  }
};

// Crea o actualiza un cierre de calendario.
export const guardarCierre = async (
  body: unknown,
  user: AuthenticatedUser,
  id?: string
) => {
  // Valida los datos recibidos.
  const datos = cierreSchema.parse(body);

  // Comprueba los permisos y recupera el cierre existente.
  const { current } = await authorizeCierre(
    user,
    datos,
    id
  );

  // Impide modificar manualmente los feriados importados.
  if (current?.fuente_externa) {
    throw new AppError(
      'Los feriados de ArgentinaDatos son de solo lectura. Usá Actualizar feriados nacionales.',
      403
    );
  }

  // Evita guardar cambios que afecten turnos vigentes.
  await assertNoAgendaAffected(
    'cierre',
    datos
  );

  // Guarda el cierre mediante el repositorio.
  const saved = await saveCierre(
    id ?? null,
    datos,
    user.id_usuario
  );

  if (!saved) {
    throw new AppError(
      'Cierre no encontrado',
      404
    );
  }

  // Notifica a los profesionales sobre la actualización.
  await notifyAgenda(current, saved);

  return saved;
};

// Desactiva un cierre de calendario existente.
export const desactivarCierre = async (
  id: string,
  user: AuthenticatedUser
) => {
  // Obtiene el alcance autorizado del usuario.
  const scope = await cierreScope(user);

  // Recupera el cierre que se desea desactivar.
  const current = await findCierre(id);

  if (!current) {
    throw new AppError(
      'Cierre no encontrado',
      404
    );
  }

  // Impide desactivar manualmente los feriados importados.
  if (current.fuente_externa) {
    throw new AppError(
      'Los feriados de ArgentinaDatos son de solo lectura',
      403
    );
  }

  // Verifica los permisos sobre el cierre.
  assertCierreScope(scope, current);

  // Solo cambia el estado activo para no sobrescribir ediciones concurrentes.
  const saved = await saveCierre(
    id,
    { activo: false },
    user.id_usuario
  );

  if (!saved) {
    throw new AppError(
      'Cierre no encontrado',
      404
    );
  }

  // Notifica a los profesionales sobre la desactivación.
  await notifyAgenda(current, saved);

  return saved;
};
