import { 
  findTurnos 
} from "../repositories/turno-read.repository.js";

import { 
  getTurnoScope, 
  assertTurnoScope 
} from "./turno-access.service.js";

import { 
  getTurnoState 
} from "./turno-read.service.js";

import { 
  agendaDateTime 
} from "../utils/turno-time.js";

import { 
  AppError 
} from "../utils/app-error.js";

import type { 
  AuthenticatedUser 
} from "../types/auth.types.js";

import type { 
  TurnoRow 
} from "../types/turno.types.js";

import type { 
  AgendaLista 
} from "../types/reporte-agenda.types.js";

import type { 
  ReporteAgendaQuery 
} from "../validators/reporte.validator.js";

type Persona = { nombres: string; apellidos: string; dni?: string };
import { getOwnEntity } from "./auth-profile.service.js";
import { reportScopeLabel, reportDate } from './reporte-documento.js';
import { supabase } from '../config/supabase.js';

type Relacion<T> = T | T[] | null;

type AgendaTurno = TurnoRow & {
  paciente: Relacion<{ persona: Relacion<Persona> }>;
  profesional: Relacion<{ persona: Relacion<Persona>; matricula?: string | null }>;
  salita: Relacion<{ nombre: string; direccion: string | null }>;
  especialidad: Relacion<{ nombre: string }>;
};

const one = <T>(value: Relacion<T>) => Array.isArray(value) ? value[0] : value;

const nombre = (persona: Persona | null | undefined) => persona
  ? `${persona.apellidos} ${persona.nombres}`.trim() : "Sin datos";

export const getAgendaDiaria = async (
  filters: ReporteAgendaQuery, user: AuthenticatedUser
) => {
   // También se protege el servicio para llamadas que no pasen por las rutas HTTP.
  if (!["SUPER_ADMIN", "ADMIN_SALITA", "PROFESIONAL"].includes(
    user.rol
  )
) throw new AppError(
  "No tiene permisos para consultar la agenda diaria",
  403
);

  const own = user.rol === "PROFESIONAL" ? await getOwnEntity(user) : null;
  const scope = own ? null : await getTurnoScope(user);
  if (own) filters = { ...filters, id_profesional: own.id };

  if (filters.id_salita) assertTurnoScope(scope, filters.id_salita);

  const contexto = [
    `Período: ${reportDate(filters.fecha_desde ?? filters.fecha)} al ${reportDate(filters.fecha_hasta ?? filters.fecha)}`,
    ...await reportScopeLabel(filters.id_salita, scope),
  ];
  if (filters.id_profesional && (own || scope === null)) {
    const { data, error } = await supabase.from('profesionales')
      .select('matricula,persona:personas(nombres,apellidos)').eq('id_profesional', filters.id_profesional).maybeSingle();
    if (error) throw new AppError('No se pudieron obtener los datos del profesional', 500);
    if (data) contexto.push(`Profesional: ${nombre(one(data.persona))}`, `Matrícula: ${data.matricula ?? 'No registrada'}`);
  }
  const state = filters.estado ? await getTurnoState(filters.estado) : null;
  contexto.push(`Estado: ${state?.nombre ?? 'Todos los estados'}`);

  const listas = new Map<string, AgendaLista>();
  
  if (scope?.length === 0) 
    return {
   sistema: "SAPS Turno", 
   fecha: filters.fecha_desde ?? filters.fecha,
   total_pacientes: 0,
   contexto,
   listas: []
  };

  
  {
    // Se recorren todas las páginas; una exportación no debe truncarse a 20/100 turnos.
    for (let page = 1; ; page++) {
      const result = await findTurnos(
        { 
          ...filters, page, limit: 100 }, scope, state?.id_estado
        );

      for (const turno of result.turnos as AgendaTurno[]) {
        const day = agendaDateTime(turno.fecha_hora_inicio).date;
        const key = `${day}/${turno.id_profesional}/${turno.id_salita}/${turno.id_especialidad}`;

        let lista = listas.get(key);
        
        if (!lista) {
          const salita = one(turno.salita);
          lista = { 
            fecha: day,
            id_salita: turno.id_salita,
            salita: salita?.nombre ?? "Sin datos",
            direccion: salita?.direccion ?? null, 
            id_profesional: turno.id_profesional,
            matricula: one(turno.profesional)?.matricula ?? null,
            profesional: nombre(
              one(
                one(
                  turno.profesional
                )?.persona ?? null
              )
            ),

            id_especialidad: turno.id_especialidad, 
            especialidad: one(
              turno.especialidad
            )?.nombre ?? "Sin datos",
            total_pacientes: 0, 
            pacientes: [] 
          };
          listas.set(key, lista);
        }

        const persona = one(one(turno.paciente)?.persona ?? null);

        lista.pacientes.push({ id_turno: turno.id_turno, codigo_turno: turno.codigo_turno,
          hora: agendaDateTime(turno.fecha_hora_inicio).time.slice(0, 5),
          apellido_nombre: nombre(persona), dni: persona?.dni ?? "", estado: turno.estado.codigo,
          estado_nombre: turno.estado.nombre,
          motivo_consulta: turno.motivo_consulta });
        lista.total_pacientes++;
      }

      if (page * 100 >= result.total || result.turnos.length === 0) break;
    }
  }
  
  const grupos = [...listas.values()].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.profesional.localeCompare(b.profesional, "es")
    || a.salita.localeCompare(b.salita, "es") || a.especialidad.localeCompare(b.especialidad, "es"));

  return { 
    sistema: "SAPS Turno", 
    fecha: filters.fecha_desde ?? filters.fecha,
    contexto,
    total_pacientes: grupos.reduce(
      (
        sum,
        lista
      ) => sum + lista.total_pacientes, 0
    ), 
    listas: grupos
  };
};
