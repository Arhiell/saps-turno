
import { fetchFeriados } from '../repositories/argentinadatos.repository.js';

import {
  claimCalendarioSync,
  applyFeriados,
  finishCalendarioSync,
  getCalendarioSync,
  type SyncYearResult,
} from '../repositories/cierre-calendario.repository.js';

import { agendaDateTime } from '../utils/turno-time.js';
import { notificarCalendario } from './cierre-calendario.service.js';
import { AppError } from '../utils/app-error.js';

import type { AuthenticatedUser } from '../types/auth.types.js';

// Sincroniza los feriados nacionales de forma manual o automática.
// El lease persistente evita ejecuciones simultáneas y recupera procesos interrumpidos.
const synchronize = async (user?: AuthenticatedUser) => {
  // Restringe la sincronización manual al superadministrador.
  if (user && user.rol !== 'SUPER_ADMIN') {
    throw new AppError(
      'Solo SUPER_ADMIN puede sincronizar feriados nacionales',
      403
    );
  }

  // Solicita autorización para iniciar la sincronización.
  const token = await claimCalendarioSync(
    !!user,
    user?.id_usuario ?? null
  );

  // Evita iniciar otra ejecución si existe una sincronización activa.
  if (!token) {
    return {
      iniciado: false,
      mensaje: user
        ? 'Ya hay una sincronización en curso. Actualizá el estado en unos momentos.'
        : 'No corresponde ejecutar todavía.',
    };
  }

  // Obtiene el año actual según la fecha utilizada por la agenda.
  const year = Number(
    agendaDateTime(new Date()).date.slice(0, 4)
  );

  const resultados: SyncYearResult[] = [];

  // Sincroniza los feriados del año actual y del siguiente.
  for (const anio of [year, year + 1]) {
    let filas;

    // Consulta los feriados publicados por ArgentinaDatos.
    try {
      filas = await fetchFeriados(anio);
    } catch (error) {
      console.warn(
        `ArgentinaDatos: no se pudo obtener el año ${anio}`,
        error
      );

      resultados.push({
        anio,
        estado: 'NO_DISPONIBLE',
        mensaje:
          'La fuente no publicó datos válidos o no pudo consultarse. Se conserva lo almacenado.',
      });

      continue;
    }

    // Persiste los feriados obtenidos para el año correspondiente.
    try {
      resultados.push(
        await applyFeriados(token, anio, filas)
      );
    } catch (error) {
      console.error(
        `No se pudo persistir el calendario ${anio}`,
        error
      );

      resultados.push({
        anio,
        estado: 'ERROR',
        mensaje:
          'No se pudo guardar este año. Se conservan los datos anteriores; podés reintentar manualmente.',
      });
    }
  }

  // Determina si la sincronización del año actual fue exitosa.
  const exito = resultados[0]?.estado === 'OK';

  // Genera el resumen general de la sincronización.
  const resumen = {
    estado: resultados.every((r) => r.estado === 'OK')
      ? 'OK'
      : exito
        ? 'PARCIAL'
        : 'ERROR',
    resultados,
  };

  // Registra la finalización y el resultado de la ejecución.
  await finishCalendarioSync(
    token,
    resumen,
    exito
  );

  // Notifica cuando se incorporaron o actualizaron feriados.
  if (
    resultados.some(
      (r) =>
        (r.nuevos ?? 0) +
          (r.actualizados ?? 0) >
        0
    )
  ) {
    try {
      await notificarCalendario(null);
    } catch (error) {
      console.error(
        'No se pudo avisar la actualización del calendario',
        error
      );
    }
  }

  // Registra el modo de ejecución y su resultado.
  console.info(
    'Sincronización de feriados finalizada',
    user ? 'MANUAL' : 'AUTOMATICA',
    resumen
  );

  return {
    iniciado: true,
    mensaje: exito
      ? 'Feriados nacionales actualizados. Revisá los turnos pendientes.'
      : 'No se pudo completar la actualización del año actual.',
    ...resumen,
  };
};

// Ejecuta la sincronización manual solicitada por un usuario autorizado.
export const sincronizarFeriados = (
  user: AuthenticatedUser
) => synchronize(user);

// Consulta el estado de sincronización según los permisos del usuario.
export const estadoSincronizacion = async (
  user: AuthenticatedUser
) => {
  // Permite consultar el estado únicamente a roles administrativos.
  if (
    !['SUPER_ADMIN', 'ADMIN_SALITA'].includes(user.rol)
  ) {
    throw new AppError(
      'No tiene permisos para consultar la sincronización',
      403
    );
  }

  const status = await getCalendarioSync();

  // El superadministrador puede consultar el estado completo.
  if (user.rol === 'SUPER_ADMIN') {
    return status;
  }

  // Oculta las cantidades globales de turnos pendientes.
  // Cada administrador consulta los pendientes dentro de su alcance.
  return {
    ...status,
    resumen: {
      ...status.resumen,
      resultados: status.resumen.resultados?.map(
        ({
          turnos_pendientes: _cantidad,
          ...result
        }) => result
      ),
    },
  };
};

// Controla el intervalo mínimo entre verificaciones automáticas.
let nextCheck = 0;

// Se invoca desde el procesador periódico existente; no crea otro temporizador.
export const revisarSincronizacionCalendario = async () => {
  // Evita realizar verificaciones antes del próximo intervalo.
  if (Date.now() < nextCheck) {
    return;
  }

  // Programa la próxima verificación dentro de 60 segundos.
  nextCheck = Date.now() + 60_000;

  // Ejecuta la sincronización automática.
  await synchronize();
};
