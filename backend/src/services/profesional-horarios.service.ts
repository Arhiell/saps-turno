import { supabase } from '../config/supabase.js';
import { getSalitasByProfesional } from '../repositories/profesional-salita.repository.js';
import { getOwnEntity } from './auth-profile.service.js';
import { agendaDateTime, agendaDayBounds } from '../utils/turno-time.js';
import { AppError } from '../utils/app-error.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import { findCierres } from '../repositories/cierre-calendario.repository.js';
import { cierreAfecta, cierreEtiqueta } from '../utils/cierre-calendario.js';

interface HorarioDb {
  id_horario: string;
  id_profesional: string;
  id_especialidad: string;
  id_salita: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  duracion_turno_minutos: number;
  cupo_maximo_diario: number | null;
  vigencia_desde: string;
  vigencia_hasta: string | null;
  activo: boolean;
}

interface BloqueoDb {
  id_bloqueo: string;
  id_profesional: string | null;
  id_salita: string;
  id_especialidad: string | null;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  dia_completo: boolean;
  motivo: string;
  activo: boolean;
}

interface TurnoDb {
  id_turno: string;
  codigo_turno: string;
  fecha_hora_inicio: string;
  fecha_hora_fin: string;
  motivo_consulta: string | null;
  ocupa_agenda: boolean;
  id_salita: string;
  id_especialidad: string;
  id_paciente: string;
  id_estado: string;
}

export interface SlotDisponibilidad {
  hora_inicio: string;
  hora_fin: string;
  estado: 'DISPONIBLE' | 'OCUPADO' | 'BLOQUEADO' | 'FINALIZADO' | 'NO_DISPONIBLE';
  motivo?: string | undefined;
  id_turno?: string | undefined;
  codigo_turno?: string | undefined;
  paciente?: string | undefined;
  dni?: string | undefined;
  estado_turno?: string | undefined;
}

const DIAS_SEMANA = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

const timeToMinutes = (timeStr: string): number => {
  const parts = timeStr.split(':');
  return Number(parts[0] ?? 0) * 60 + Number(parts[1] ?? 0);
};

const minutesToTime = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const getMisHorariosYDisponibilidad = async (
  user: AuthenticatedUser,
  fechaParam?: string
) => {
  // 1. Obtener la entidad profesional vinculada al usuario autenticado.
  const own = await getOwnEntity(user);
  if (own.key !== 'id_profesional') {
    throw new AppError('Acceso restringido a profesionales', 403);
  }
  const idProfesional = own.id;

  // 2. Determinar la fecha de consulta (por defecto hoy en la zona municipal).
  const todayInfo = agendaDateTime(new Date());
  const fecha = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam)
    ? fechaParam
    : todayInfo.date;

  const fechaInfo = agendaDateTime(new Date(`${fecha}T12:00:00Z`));
  const diaSemanaConsulta = fechaInfo.weekday; // 1 a 7

  // 3. Consultar datos del profesional (matrícula y persona).
  const { data: profData, error: errProf } = await supabase
    .from('profesionales')
    .select('id_profesional, matricula, activo, id_persona')
    .eq('id_profesional', idProfesional)
    .single();

  if (errProf || !profData) {
    throw new AppError('Profesional no encontrado', 404);
  }

  // Consultar datos personales
  const { data: personaData } = await supabase
    .from('personas')
    .select('nombres, apellidos, dni')
    .eq('id_persona', profData.id_persona)
    .maybeSingle();

  const nombreCompleto = personaData
    ? `${personaData.apellidos} ${personaData.nombres}`
    : 'Profesional';

  // 4. Consultar horarios semanales activos del profesional.
  const { data: horariosData, error: errHorarios } = await supabase
    .from('horarios_atencion')
    .select(`
      id_horario,
      id_profesional,
      id_especialidad,
      id_salita,
      dia_semana,
      hora_inicio,
      hora_fin,
      duracion_turno_minutos,
      cupo_maximo_diario,
      vigencia_desde,
      vigencia_hasta,
      activo
    `)
    .eq('id_profesional', idProfesional)
    .eq('activo', true)
    .order('dia_semana', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (errHorarios) throw errHorarios;

  const asociaciones = await getSalitasByProfesional(idProfesional, null, fecha);
  const salitasVigentes = new Set((asociaciones ?? []).map(row => row.id_salita));
  const horarios = ((horariosData ?? []) as HorarioDb[]).filter(h =>
    salitasVigentes.has(h.id_salita) && h.vigencia_desde <= fecha &&
    (h.vigencia_hasta === null || h.vigencia_hasta >= fecha));

  // 5. Cargar nombres de salitas y especialidades referenciadas sin joins de FK
  const salitaIds = Array.from(new Set(horarios.map(h => h.id_salita)));
  const cierres = await findCierres(salitaIds, fecha, fecha, true);
  const especialidadIds = Array.from(new Set(horarios.map(h => h.id_especialidad)));

  const salitasMap = new Map<string, string>();
  if (salitaIds.length > 0) {
    const { data: salitasData } = await supabase
      .from('salitas')
      .select('id_salita, nombre')
      .in('id_salita', salitaIds);

    salitasData?.forEach(s => salitasMap.set(s.id_salita, s.nombre));
  }

  const especialidadesMap = new Map<string, string>();
  if (especialidadIds.length > 0) {
    const { data: espData } = await supabase
      .from('especialidades')
      .select('id_especialidad, nombre')
      .in('id_especialidad', especialidadIds);

    espData?.forEach(e => especialidadesMap.set(e.id_especialidad, e.nombre));
  }

  // 6. Consultar bloqueos activos que afecten a la fecha de consulta.
  const { data: bloqueosData, error: errBloqueos } = await supabase
    .from('bloqueos_agenda')
    .select(`
      id_bloqueo,
      id_profesional,
      id_salita,
      id_especialidad,
      fecha,
      hora_inicio,
      hora_fin,
      dia_completo,
      motivo,
      activo
    `)
    .eq('activo', true)
    .eq('fecha', fecha)
    .or(`id_profesional.is.null,id_profesional.eq.${idProfesional}`);

  if (errBloqueos) throw errBloqueos;

  const bloqueos = (bloqueosData ?? []) as BloqueoDb[];

  // 7. Consultar turnos del profesional para la fecha consultada.
  const bounds = agendaDayBounds(fecha);
  const { data: turnosData, error: errTurnos } = await supabase
    .from('turnos')
    .select(`
      id_turno,
      codigo_turno,
      fecha_hora_inicio,
      fecha_hora_fin,
      motivo_consulta,
      ocupa_agenda,
      id_salita,
      id_especialidad,
      id_paciente,
      id_estado
    `)
    .eq('id_profesional', idProfesional)
    .gte('fecha_hora_inicio', bounds.start)
    .lt('fecha_hora_inicio', bounds.end);

  if (errTurnos) throw errTurnos;

  const turnos = (turnosData ?? []) as TurnoDb[];

  // 8. Cargar detalles de pacientes y estados de turno si hay turnos en el día
  const pacientesMap = new Map<string, { nombre: string; dni?: string }>();
  const estadosTurnoMap = new Map<string, string>();

  if (turnos.length > 0) {
    const pacienteIds = Array.from(new Set(turnos.map(t => t.id_paciente)));
    const estadoIds = Array.from(new Set(turnos.map(t => t.id_estado)));

    const [pacientesRes, estadosRes] = await Promise.all([
      supabase.from('pacientes').select('id_paciente, id_persona').in('id_paciente', pacienteIds),
      supabase.from('estados_turno').select('id_estado, nombre').in('id_estado', estadoIds),
    ]);

    estadosRes.data?.forEach(st => estadosTurnoMap.set(st.id_estado, st.nombre));

    const personaIds = (pacientesRes.data ?? []).map(p => p.id_persona);
    if (personaIds.length > 0) {
      const { data: personasData } = await supabase
        .from('personas')
        .select('id_persona, nombres, apellidos, dni')
        .in('id_persona', personaIds);

      const personaMap = new Map(personasData?.map(p => [p.id_persona, p]) ?? []);

      pacientesRes.data?.forEach(pac => {
        const pers = personaMap.get(pac.id_persona);
        if (pers) {
          pacientesMap.set(pac.id_paciente, {
            nombre: `${pers.apellidos} ${pers.nombres}`,
            dni: pers.dni ?? undefined,
          });
        }
      });
    }
  }

  // 9. Generar cronograma semanal (Lunes 1 a Domingo 7).
  const cronogramaSemanal = Array.from({ length: 7 }, (_, i) => {
    const diaNum = i + 1;
    const franjasDia = horarios.filter(h => h.dia_semana === diaNum);
    return {
      dia_semana: diaNum,
      nombre_dia: DIAS_SEMANA[i],
      trabaja: franjasDia.length > 0,
      franjas: franjasDia.map(h => ({
        id_horario: h.id_horario,
        hora_inicio: h.hora_inicio.slice(0, 5),
        hora_fin: h.hora_fin.slice(0, 5),
        duracion_turno_minutos: h.duracion_turno_minutos,
        cupo_maximo_diario: h.cupo_maximo_diario,
        salita: salitasMap.get(h.id_salita) ?? 'Salita',
        id_salita: h.id_salita,
        especialidad: especialidadesMap.get(h.id_especialidad) ?? 'Especialidad',
        id_especialidad: h.id_especialidad,
      })),
    };
  });

  // 10. Información general y duraciones reales
  const diasLaborales = cronogramaSemanal
    .filter(d => d.trabaja)
    .map(d => d.nombre_dia);

  const duraciones = horarios.map(h => h.duracion_turno_minutos).filter(Boolean);
  const duracionesUnicas = Array.from(new Set(duraciones)).sort((a, b) => a - b);
  const esDuracionUniforme = duracionesUnicas.length <= 1;
  const duracionPrincipal = duracionesUnicas.length > 0 ? duracionesUnicas[0] : 30;
  const duracionTexto = duracionesUnicas.length === 1
    ? `${duracionesUnicas[0]} min`
    : duracionesUnicas.length > 1
    ? duracionesUnicas.map(d => `${d} min`).join(' / ')
    : '30 min';

  // Analizar si los horarios son uniformes o varían por día
  const diasConFranjas = cronogramaSemanal.filter(d => d.trabaja);
  const horariosPorDia = diasConFranjas.map(d => ({
    dia: d.nombre_dia,
    franjas: d.franjas.map(f => `${f.hora_inicio} a ${f.hora_fin}`).join(', '),
  }));

  const franjasUnicas = new Set(horariosPorDia.map(h => h.franjas));
  const esHorarioUniforme = franjasUnicas.size <= 1;

  let rangoHorarioGeneral = 'Sin horarios configurados';
  if (diasConFranjas.length > 0) {
    if (esHorarioUniforme) {
      rangoHorarioGeneral = horariosPorDia[0]?.franjas ?? 'Sin horarios';
    } else {
      rangoHorarioGeneral = 'Horarios diferenciados por día';
    }
  }

  const salitasUnicas = Array.from(new Set(Array.from(salitasMap.values())));
  const especialidadesUnicas = Array.from(new Set(Array.from(especialidadesMap.values())));

  // 11. Calcular disponibilidad para la fecha de consulta
  const franjasFecha = horarios.filter(h => {
    if (h.dia_semana !== diaSemanaConsulta) return false;
    if (h.vigencia_desde > fecha) return false;
    if (h.vigencia_hasta && h.vigencia_hasta < fecha) return false;
    return true;
  });

  const bloqueoDiaCompleto = bloqueos.find(b => b.dia_completo);

  // Fecha y hora actual en zona horaria de Argentina
  const now = new Date();
  const todayInArg = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(now);
  const nowTimestamp = now.getTime();
  const isPastDate = fecha < todayInArg;
  const isToday = fecha === todayInArg;

  let totalSlots = 0;
  let disponiblesSlots = 0;
  let ocupadosSlots = 0;
  let bloqueadosSlots = 0;
  let finalizadosSlots = 0;

  const franjasDisponibilidad = franjasFecha.map(h => {
    const inicioMin = timeToMinutes(h.hora_inicio);
    const finMin = timeToMinutes(h.hora_fin);
    const duracion = h.duracion_turno_minutos || 30;

    const slots: SlotDisponibilidad[] = [];

    for (let m = inicioMin; m + duracion <= finMin; m += duracion) {
      const slotInicioStr = minutesToTime(m);
      const slotFinStr = minutesToTime(m + duracion);

      const slotInicioDate = new Date(`${fecha}T${slotInicioStr}:00-03:00`);
      const slotFinDate = new Date(`${fecha}T${slotFinStr}:00-03:00`);
      const slotEnded = slotFinDate.getTime() <= nowTimestamp;

      totalSlots++;

      const cierre = cierres.find(c => cierreAfecta(c, h.id_salita, fecha, slotInicioStr, slotFinStr));
      if (cierre) {
        bloqueadosSlots++;
        slots.push({ hora_inicio: slotInicioStr, hora_fin: slotFinStr, estado: 'BLOQUEADO', motivo: cierreEtiqueta(cierre) });
        continue;
      }

      // Revisar si está bloqueado por día completo
      if (bloqueoDiaCompleto) {
        bloqueadosSlots++;
        slots.push({
          hora_inicio: slotInicioStr,
          hora_fin: slotFinStr,
          estado: 'BLOQUEADO',
          motivo: bloqueoDiaCompleto.motivo,
        });
        continue;
      }

      // Revisar si está bloqueado por franja
      const bloqueoParcial = bloqueos.find(b => {
        if (!b.hora_inicio || !b.hora_fin) return false;
        if (b.id_salita && b.id_salita !== h.id_salita) return false;
        const bInicio = new Date(`${fecha}T${b.hora_inicio.slice(0, 5)}:00-03:00`);
        const bFin = new Date(`${fecha}T${b.hora_fin.slice(0, 5)}:00-03:00`);
        return slotInicioDate < bFin && slotFinDate > bInicio;
      });

      if (bloqueoParcial) {
        bloqueadosSlots++;
        slots.push({
          hora_inicio: slotInicioStr,
          hora_fin: slotFinStr,
          estado: 'BLOQUEADO',
          motivo: bloqueoParcial.motivo,
        });
        continue;
      }

      // Revisar si está ocupado por un turno (conservando turnos históricos)
      const turnoOcupante = turnos.find(t => {
        if (!t.ocupa_agenda) return false;
        const tInicio = new Date(t.fecha_hora_inicio);
        const tFin = new Date(t.fecha_hora_fin);
        return slotInicioDate < tFin && slotFinDate > tInicio;
      });

      if (turnoOcupante) {
        ocupadosSlots++;
        const pacInfo = pacientesMap.get(turnoOcupante.id_paciente);
        slots.push({
          hora_inicio: slotInicioStr,
          hora_fin: slotFinStr,
          estado: 'OCUPADO',
          id_turno: turnoOcupante.id_turno,
          codigo_turno: turnoOcupante.codigo_turno,
          paciente: pacInfo?.nombre ?? 'Paciente',
          dni: pacInfo?.dni ?? undefined,
          estado_turno: estadosTurnoMap.get(turnoOcupante.id_estado) ?? 'Ocupado',
        });
        continue;
      }

      // Si la fecha ya pasó o el horario del slot ya terminó hoy:
      // Se muestra como finalizado / no disponible, nunca como libre para reservar
      if (isPastDate || (isToday && slotEnded)) {
        finalizadosSlots++;
        slots.push({
          hora_inicio: slotInicioStr,
          hora_fin: slotFinStr,
          estado: 'FINALIZADO',
          motivo: isPastDate ? 'Fecha pasada' : 'Horario finalizado',
        });
        continue;
      }

      // Slot futuro libre
      disponiblesSlots++;
      slots.push({
        hora_inicio: slotInicioStr,
        hora_fin: slotFinStr,
        estado: 'DISPONIBLE',
      });
    }

    return {
      id_horario: h.id_horario,
      hora_inicio: h.hora_inicio.slice(0, 5),
      hora_fin: h.hora_fin.slice(0, 5),
      duracion_turno_minutos: h.duracion_turno_minutos,
      salita: salitasMap.get(h.id_salita) ?? 'Salita',
      id_salita: h.id_salita,
      especialidad: especialidadesMap.get(h.id_especialidad) ?? 'Especialidad',
      id_especialidad: h.id_especialidad,
      slots,
    };
  });

  // Duración real para la fecha consultada
  const duracionesDia = franjasFecha.map(h => h.duracion_turno_minutos).filter(Boolean);
  const duracionesDiaUnicas = Array.from(new Set(duracionesDia)).sort((a, b) => a - b);
  const duracionDiaTexto = duracionesDiaUnicas.length === 1
    ? `${duracionesDiaUnicas[0]} min`
    : duracionesDiaUnicas.length > 1
    ? duracionesDiaUnicas.map(d => `${d} min`).join(' / ')
    : duracionTexto;

  return {
    profesional: {
      id_profesional: profData.id_profesional,
      matricula: profData.matricula,
      nombre_completo: nombreCompleto,
    },
    informacion_general: {
      dias_laborales: diasLaborales,
      horario_atencion: rangoHorarioGeneral,
      es_horario_uniforme: esHorarioUniforme,
      horarios_por_dia: horariosPorDia,
      duracion_turno_minutos: duracionPrincipal,
      es_duracion_uniforme: esDuracionUniforme,
      duraciones_disponibles: duracionesUnicas,
      duracion_descripcion: duracionTexto,
      salitas: salitasUnicas,
      especialidades: especialidadesUnicas,
      salitas_detalle: Array.from(salitasMap.entries()).map(([id, nombre]) => ({ id, nombre })),
      especialidades_detalle: Array.from(especialidadesMap.entries()).map(([id, nombre]) => ({ id, nombre })),
    },
    cronograma_semanal: cronogramaSemanal,
    disponibilidad_fecha: {
      fecha,
      dia_semana: diaSemanaConsulta,
      nombre_dia: DIAS_SEMANA[diaSemanaConsulta - 1],
      trabaja: franjasFecha.length > 0,
      bloqueo_dia_completo: bloqueoDiaCompleto
        ? { bloqueado: true, motivo: bloqueoDiaCompleto.motivo }
        : { bloqueado: false },
      resumen_slots: {
        total: totalSlots,
        disponibles: disponiblesSlots,
        ocupados: ocupadosSlots,
        bloqueados: bloqueadosSlots,
        finalizados: finalizadosSlots,
      },
      duracion_dia_minutos: duracionesDiaUnicas.length === 1 ? duracionesDiaUnicas[0] : duracionPrincipal,
      duracion_dia_descripcion: duracionDiaTexto,
      franjas: franjasDisponibilidad,
    },
  };
};
