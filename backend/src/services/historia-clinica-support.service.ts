import { getSalitasByProfesional } from '../repositories/profesional-salita.repository.js';
import { getEspecialidadesByProfesional } from '../repositories/profesional-especialidad.repository.js';
import {
  findProfesionalIdentity,
  getProfesionalById,
} from '../repositories/profesional.repository.js';
import {
  findActiveDerivedPatientIdsForSalitas,
  findClinicalPatientsByScope,
  listActiveEspecialidadesCatalog,
  listActiveProfesionalesCatalog,
  listActiveSalitasCatalog,
  listUserAssignedSalitas,
} from '../repositories/historia-clinica-support.repository.js';
import { rpcListarDerivacionesClinicas } from '../repositories/historia-clinica.repository.js';
import { getRolePermissions } from './permission.service.js';
import { CLINICAL_PERMISSIONS } from '../types/permission.types.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import { AppError } from '../utils/app-error.js';
import { agendaDateTime } from '../utils/turno-time.js';

interface NamedItem {
  id_salita?: string;
  id_especialidad?: string;
  nombre: string;
  activo: boolean;
}

const pickEntity = <T extends NamedItem>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

const isCurrent = (
  row: { activo: boolean; fecha_desde: string; fecha_hasta: string | null },
  today: string
): boolean =>
  row.activo &&
  row.fecha_desde <= today &&
  (!row.fecha_hasta || row.fecha_hasta >= today);

const resolveActiveProfessional = async (user: AuthenticatedUser) => {
  if (user.rol !== 'PROFESIONAL' || !user.id_persona) {
    throw new AppError(
      'Acceso clínico restringido a profesionales con perfil vinculado',
      403
    );
  }

  const identity = await findProfesionalIdentity('id_persona', user.id_persona);
  if (!identity) {
    throw new AppError('No se encontró un perfil profesional vinculado al usuario', 403);
  }

  const profesional = await getProfesionalById(identity.id_profesional);
  if (!profesional || !profesional.activo) {
    throw new AppError('No se encontró un perfil profesional activo para el usuario', 403);
  }

  return profesional.id_profesional;
};

export const getHistoriaClinicaContext = async (user: AuthenticatedUser) => {
  const today = agendaDateTime(new Date()).date;
  const rolePermissions = await getRolePermissions({
    codigo: user.rol,
    ...(user.id_rol ? { idRol: user.id_rol } : {}),
  });
  const perms = rolePermissions?.activo ? rolePermissions.permissions : new Set<string>();

  const hasAnyClinicalPerm = Object.values(CLINICAL_PERMISSIONS).some((code) =>
    perms.has(code)
  );

  if (!hasAnyClinicalPerm) {
    throw new AppError('No tenés permisos clínicos habilitados para consultar este contexto', 403);
  }

  if (user.rol === 'PROFESIONAL') {
    const idProfesional = await resolveActiveProfessional(user);
    const [profSalitas, profEspecialidades, catSalitas, catEsp, catProf] = await Promise.all([
      getSalitasByProfesional(idProfesional, null, today),
      getEspecialidadesByProfesional(idProfesional),
      listActiveSalitasCatalog(),
      listActiveEspecialidadesCatalog(),
      listActiveProfesionalesCatalog(),
    ]);

    const salitasAutorizadas = profSalitas
      .filter((row) => isCurrent(row, today))
      .flatMap((row) => {
        const s = pickEntity(row.salita as unknown as NamedItem | NamedItem[] | null);
        return s?.activo
          ? [{ id_salita: String(row.id_salita), nombre: s.nombre }]
          : [];
      });

    const especialidadesAutorizadas = profEspecialidades
      .filter((row) => isCurrent(row, today))
      .flatMap((row) => {
        const e = pickEntity(row.especialidad as unknown as NamedItem | NamedItem[] | null);
        return e?.activo
          ? [{ id_especialidad: String(row.id_especialidad), nombre: e.nombre }]
          : [];
      });

    return {
      id_profesional: idProfesional,
      salitas_autorizadas: salitasAutorizadas,
      especialidades_autorizadas: especialidadesAutorizadas,
      catalogo_salitas: catSalitas,
      catalogo_especialidades: catEsp,
      catalogo_profesionales: catProf,
    };
  }

  if (user.rol === 'SUPER_ADMIN') {
    const catSalitas = await listActiveSalitasCatalog();
    return {
      id_profesional: null,
      salitas_autorizadas: catSalitas,
      especialidades_autorizadas: [],
      catalogo_salitas: catSalitas,
      catalogo_especialidades: [],
      catalogo_profesionales: [],
    };
  }

  if (user.rol === 'ADMIN_SALITA' || user.rol === 'RECEPCION') {
    const assignments = await listUserAssignedSalitas(user.id_usuario);
    const salitasAutorizadas = assignments
      .filter((row) => isCurrent(row, today))
      .flatMap((row) => {
        const s = pickEntity(row.salita as unknown as NamedItem | NamedItem[] | null);
        return s?.activo
          ? [{ id_salita: String(row.id_salita), nombre: s.nombre }]
          : [];
      });

    const catSalitas = await listActiveSalitasCatalog();
    return {
      id_profesional: null,
      salitas_autorizadas: salitasAutorizadas,
      especialidades_autorizadas: [],
      catalogo_salitas: catSalitas,
      catalogo_especialidades: [],
      catalogo_profesionales: [],
    };
  }

  throw new AppError('Rol no autorizado en Historia Clínica', 403);
};

export const searchClinicalPatients = async (
  user: AuthenticatedUser,
  query: {
    search?: string | undefined;
    id_salita?: string | undefined;
    page: number;
    limit: number;
  }
) => {
  const today = agendaDateTime(new Date()).date;
  let authorizedSalitas: { id_salita: string; nombre: string }[] = [];

  if (user.rol === 'PROFESIONAL') {
    const idProfesional = await resolveActiveProfessional(user);
    const profSalitas = await getSalitasByProfesional(idProfesional, null, today);

    authorizedSalitas = profSalitas
      .filter((row) => isCurrent(row, today))
      .flatMap((row) => {
        const s = pickEntity(row.salita as unknown as NamedItem | NamedItem[] | null);
        return s?.activo ? [{ id_salita: String(row.id_salita), nombre: s.nombre }] : [];
      });
  } else if (user.rol === 'ADMIN_SALITA' || user.rol === 'RECEPCION') {
    const assignments = await listUserAssignedSalitas(user.id_usuario);
    authorizedSalitas = assignments
      .filter((row) => isCurrent(row, today))
      .flatMap((row) => {
        const s = pickEntity(row.salita as unknown as NamedItem | NamedItem[] | null);
        return s?.activo ? [{ id_salita: String(row.id_salita), nombre: s.nombre }] : [];
      });
  } else if (user.rol === 'SUPER_ADMIN') {
    const allSalitas = await listActiveSalitasCatalog();
    authorizedSalitas = allSalitas.map((s) => ({ id_salita: s.id_salita, nombre: s.nombre }));
  } else {
    throw new AppError('Rol no autorizado para buscar pacientes clínicos', 403);
  }

  const authorizedIds = authorizedSalitas.map((s) => s.id_salita);
  if (authorizedIds.length === 0) {
    return {
      patients: [],
      pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 0 },
    };
  }

  if (query.id_salita && !authorizedIds.includes(query.id_salita)) {
    throw new AppError('No tenés alcance vigente sobre la salita seleccionada', 403);
  }

  const scopedSalitaIds = query.id_salita ? [query.id_salita] : authorizedIds;

  // Incluye pacientes con derivación/autorización vigente hacia la salita consultada.
  const derivedPatientSet = new Set<string>();

  if (user.rol === 'PROFESIONAL' || user.rol === 'ADMIN_SALITA') {
    const derivacionesLists = await Promise.all(
      scopedSalitaIds.map((salitaId) =>
        rpcListarDerivacionesClinicas({
          p_usuario: user.id_usuario,
          p_salita: salitaId,
          p_estado: 'AUTORIZADA',
        }).catch(() => [])
      )
    );

    for (const rows of derivacionesLists) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const idDestino = row.id_salita_destino as string | undefined;
        const idPaciente = row.id_paciente as string | undefined;
        const desde = row.fecha_desde as string | undefined;
        const hasta = row.fecha_hasta as string | undefined;
        if (
          idDestino &&
          scopedSalitaIds.includes(idDestino) &&
          idPaciente &&
          desde &&
          hasta &&
          desde <= today &&
          hasta >= today
        ) {
          derivedPatientSet.add(idPaciente);
        }
      }
    }
  } else if (user.rol === 'RECEPCION') {
    const activeDerivedIds = await findActiveDerivedPatientIdsForSalitas(scopedSalitaIds, today);
    for (const id of activeDerivedIds) {
      derivedPatientSet.add(id);
    }
  }

  const allSalitas = await listActiveSalitasCatalog();
  const salitaNameById = new Map(allSalitas.map((s) => [s.id_salita, s.nombre]));

  const from = (query.page - 1) * query.limit;
  const to = from + query.limit - 1;

  const result = await findClinicalPatientsByScope({
    from,
    to,
    salitaIds: scopedSalitaIds,
    derivedPatientIds: Array.from(derivedPatientSet),
    search: query.search ?? '',
  });

  const patients = result.patients.map((patient) => {
    const isAssignedInScope =
      Boolean(patient.id_salita_asignada) &&
      scopedSalitaIds.includes(patient.id_salita_asignada as string);

    return {
      id_paciente: patient.id_paciente,
      dni: patient.dni,
      nombres: patient.nombres,
      apellidos: patient.apellidos,
      fecha_nacimiento: patient.fecha_nacimiento,
      sexo: patient.sexo,
      id_salita_asignada: patient.id_salita_asignada,
      salita_nombre: patient.id_salita_asignada
        ? (salitaNameById.get(patient.id_salita_asignada) ?? null)
        : null,
      activo: patient.activo,
      via_acceso_estimada: isAssignedInScope ? 'SALITA_ASIGNADA' : 'DERIVACION_AUTORIZADA',
    };
  });

  return {
    patients,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    },
  };
};
