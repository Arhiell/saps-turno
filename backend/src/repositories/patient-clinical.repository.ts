import { supabase } from '../config/supabase.js';

export interface PatientClinicalSummary {
  id_paciente: string;
  nombres: string;
  apellidos: string;
  dni: string;
  fecha_nacimiento: string | null;
  sexo: string | null;
  obra_social: string | null;
  numero_afiliado: string | null;
  id_salita_asignada: string;
  salita_nombre?: string;
  id_barrio?: string;
}

export interface PatientSignedConsulta {
  id_consulta: string;
  fecha_atencion: string;
  fecha_firma: string | null;
  motivo_consulta: string;
  anamnesis_cuadro_clinico?: string | null;
  examen_fisico?: string | null;
  plan_terapeutico?: string | null;
  especialidad: string;
  salita: string;
  salita_direccion?: string | null;
  profesional: string;
  matricula_profesional?: string | null;
  diagnosticos: {
    id_diagnostico: string;
    codigo_cie10?: string | null;
    descripcion: string;
    tipo: string;
    es_principal: boolean;
    cronico?: boolean;
  }[];
  evoluciones: {
    id_evolucion: string;
    fecha_evolucion: string;
    nota_evolucion: string;
    version: number;
    profesional?: string;
  }[];
  tratamientos: {
    id_tratamiento: string;
    medicamento: string;
    dosis?: string | null;
    frecuencia?: string | null;
    duracion_dias?: number | null;
    instrucciones?: string | null;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
  }[];
  estudios: {
    id_estudio: string;
    tipo_estudio: string;
    descripcion_pedido: string;
    estado: string;
    resultado_informe?: string | null;
    fecha_solicitud: string;
    fecha_resultado?: string | null;
  }[];
}

export interface PatientDerivacion {
  id_autorizacion_clinica: string;
  motivo_derivacion: string;
  resumen_clinico?: string | null | undefined;
  alcance: string;
  estado: string;
  fecha_solicitud: string;
  fecha_desde?: string | null | undefined;
  fecha_hasta?: string | null | undefined;
  salita_origen?: string | undefined;
  salita_destino?: string | undefined;
  especialidad_destino?: string | undefined;
  profesional_destino?: string | undefined;
}

export interface PatientHistoriaClinicaData {
  paciente: PatientClinicalSummary;
  historia_clinica: {
    id_historia_clinica: string;
    numero_historia_clinica: string;
    fecha_apertura: string;
    grupo_sanguineo?: string | null;
    factor_rh?: string | null;
  } | null;
  consultas: PatientSignedConsulta[];
  derivaciones: PatientDerivacion[];
  antecedentes: {
    id_antecedente: string;
    tipo: string;
    descripcion: string;
    fecha_antecedente?: string | null;
    estado?: string;
  }[];
  alergias: {
    id_alergia: string;
    sustancia_alergeno: string;
    tipo_reaccion?: string | null;
    severidad?: string | null;
    estado?: string;
  }[];
}

export const findPatientHistoriaClinica = async (
  patientId: string
): Promise<PatientHistoriaClinicaData> => {
  // 1. Obtener datos personales y paciente
  const { data: patientRow, error: patientErr } = await supabase
    .from('pacientes')
    .select(`
      id_paciente,
      id_salita_asignada,
      id_barrio,
      obra_social,
      numero_afiliado,
      persona:personas!inner (
        dni,
        nombres,
        apellidos,
        fecha_nacimiento,
        sexo
      ),
      salita:salitas!id_salita_asignada (
        nombre
      )
    `)
    .eq('id_paciente', patientId)
    .single();

  if (patientErr || !patientRow) {
    throw patientErr || new Error('Paciente no encontrado');
  }

  const personaObj = Array.isArray(patientRow.persona)
    ? patientRow.persona[0]
    : patientRow.persona;
  const salitaObj = Array.isArray(patientRow.salita)
    ? patientRow.salita[0]
    : patientRow.salita;

  const pacienteSummary: PatientClinicalSummary = {
    id_paciente: patientRow.id_paciente,
    nombres: personaObj?.nombres ?? '',
    apellidos: personaObj?.apellidos ?? '',
    dni: personaObj?.dni ?? '',
    fecha_nacimiento: personaObj?.fecha_nacimiento ?? null,
    sexo: personaObj?.sexo ?? null,
    obra_social: patientRow.obra_social ?? null,
    numero_afiliado: patientRow.numero_afiliado ?? null,
    id_salita_asignada: patientRow.id_salita_asignada,
    salita_nombre: salitaObj?.nombre ?? '',
    id_barrio: patientRow.id_barrio,
  };

  // 2. Obtener expediente de historia clínica si existe
  const { data: hcRow } = await supabase
    .from('historias_clinicas')
    .select('id_historia_clinica, numero_historia_clinica, fecha_apertura, grupo_sanguineo, factor_rh, activo')
    .eq('id_paciente', patientId)
    .maybeSingle();

  // Si no tiene historia clínica abierta todavía, retornar estructura limpia sin consultas
  if (!hcRow) {
    // También verificar derivaciones asociadas al paciente si existen
    const { data: derivacionesData } = await supabase
      .from('derivaciones_autorizaciones_clinicas')
      .select(`
        id_derivacion,
        motivo,
        alcance,
        estado,
        fecha_creacion,
        fecha_desde,
        fecha_hasta,
        salita_origen:salitas!id_salita_origen (nombre),
        salita_destino:salitas!id_salita_destino (nombre),
        especialidad_destino:especialidades!id_especialidad_destino (nombre)
      `)
      .eq('id_paciente', patientId)
      .order('fecha_creacion', { ascending: false });

    const derivaciones: PatientDerivacion[] = (derivacionesData ?? []).map((d: any) => ({
      id_autorizacion_clinica: d.id_derivacion,
      motivo_derivacion: d.motivo,
      alcance: d.alcance,
      estado: d.estado,
      fecha_solicitud: d.fecha_creacion,
      fecha_desde: d.fecha_desde ?? undefined,
      fecha_hasta: d.fecha_hasta ?? undefined,
      salita_origen: d.salita_origen?.nombre ?? undefined,
      salita_destino: d.salita_destino?.nombre ?? undefined,
      especialidad_destino: d.especialidad_destino?.nombre ?? undefined,
    }));

    return {
      paciente: pacienteSummary,
      historia_clinica: null,
      consultas: [],
      derivaciones,
      antecedentes: [],
      alergias: [],
    };
  }

  // 3. Consultar antecedentes y alergias
  const [antecedentesRes, alergiasRes, derivacionesRes] = await Promise.all([
    supabase
      .from('antecedentes_clinicos')
      .select('id_antecedente, tipo, descripcion, fecha_antecedente, estado')
      .eq('id_historia_clinica', hcRow.id_historia_clinica)
      .order('fecha_antecedente', { ascending: false }),
    supabase
      .from('alergias_paciente')
      .select('id_alergia, sustancia_alergeno, tipo_reaccion, severidad, estado')
      .eq('id_historia_clinica', hcRow.id_historia_clinica)
      .order('fecha_creacion', { ascending: false }),
    supabase
      .from('derivaciones_autorizaciones_clinicas')
      .select(`
        id_derivacion,
        motivo,
        alcance,
        estado,
        fecha_creacion,
        fecha_desde,
        fecha_hasta,
        salita_origen:salitas!id_salita_origen (nombre),
        salita_destino:salitas!id_salita_destino (nombre),
        especialidad_destino:especialidades!id_especialidad_destino (nombre),
        profesional_destino:profesionales!id_profesional_destino (
          persona:personas!inner (apellidos, nombres)
        )
      `)
      .eq('id_paciente', patientId)
      .order('fecha_creacion', { ascending: false }),
  ]);

  const derivaciones: PatientDerivacion[] = (derivacionesRes.data ?? []).map((d: any) => {
    const rawPersona = d.profesional_destino?.persona;
    const profPersona = Array.isArray(rawPersona) ? rawPersona[0] : rawPersona;
    const profNombre = profPersona
      ? `${profPersona.apellidos}, ${profPersona.nombres}`
      : undefined;

    return {
      id_autorizacion_clinica: d.id_derivacion,
      motivo_derivacion: d.motivo,
      alcance: d.alcance,
      estado: d.estado,
      fecha_solicitud: d.fecha_creacion,
      fecha_desde: d.fecha_desde ?? undefined,
      fecha_hasta: d.fecha_hasta ?? undefined,
      salita_origen: d.salita_origen?.nombre ?? undefined,
      salita_destino: d.salita_destino?.nombre ?? undefined,
      especialidad_destino: d.especialidad_destino?.nombre ?? undefined,
      profesional_destino: profNombre,
    };
  });

  // 4. Consultar únicamente consultas en estado 'FIRMADA' (NUNCA BORRADOR)
  const { data: consultasRows, error: consultasErr } = await supabase
    .from('consultas_medicas')
    .select(`
      id_consulta,
      fecha_atencion,
      fecha_firma,
      motivo_consulta,
      anamnesis_cuadro_clinico,
      examen_fisico,
      plan_terapeutico,
      estado,
      especialidad:especialidades!id_especialidad (
        nombre
      ),
      salita:salitas!id_salita (
        nombre,
        direccion
      ),
      profesional:profesionales!id_profesional (
        matricula,
        persona:personas!inner (
          apellidos,
          nombres
        )
      )
    `)
    .eq('id_historia_clinica', hcRow.id_historia_clinica)
    .eq('estado', 'FIRMADA')
    .order('fecha_atencion', { ascending: false });

  if (consultasErr) {
    throw consultasErr;
  }

  const consultas: PatientSignedConsulta[] = [];

  if (consultasRows && consultasRows.length > 0) {
    const consultaIds = consultasRows.map((c) => c.id_consulta);

    // Obtener detalles dependientes para las consultas firmadas
    const [diagRes, evolRes, tratRes, estRes] = await Promise.all([
      supabase
        .from('diagnosticos_clinicos')
        .select('id_diagnostico, id_consulta, codigo_cie10, descripcion, tipo, es_principal, cronico')
        .in('id_consulta', consultaIds)
        .order('es_principal', { ascending: false }),
      supabase
        .from('evoluciones_clinicas')
        .select(`
          id_evolucion,
          id_consulta,
          fecha_evolucion,
          nota_evolucion,
          version,
          estado,
          profesional:profesionales!id_profesional_responsable (
            persona:personas!inner (apellidos, nombres)
          )
        `)
        .in('id_consulta', consultaIds)
        .eq('estado', 'FIRMADA')
        .order('version', { ascending: true }),
      supabase
        .from('tratamientos_clinicos')
        .select('id_tratamiento, id_consulta, medicamento, dosis, frecuencia, duracion_dias, instrucciones, fecha_inicio, fecha_fin')
        .in('id_consulta', consultaIds)
        .order('fecha_inicio', { ascending: false }),
      supabase
        .from('estudios_clinicos')
        .select('id_estudio, id_consulta, tipo_estudio, descripcion_pedido, estado, resultado_informe, fecha_solicitud, fecha_resultado')
        .in('id_consulta', consultaIds)
        .order('fecha_solicitud', { ascending: false }),
    ]);

    const diagsByConsulta = new Map<string, any[]>();
    for (const d of diagRes.data ?? []) {
      const list = diagsByConsulta.get(d.id_consulta) ?? [];
      list.push(d);
      diagsByConsulta.set(d.id_consulta, list);
    }

    const evolsByConsulta = new Map<string, any[]>();
    for (const ev of evolRes.data ?? []) {
      const list = evolsByConsulta.get(ev.id_consulta) ?? [];
      const p = (ev as any).profesional?.persona;
      list.push({
        id_evolucion: ev.id_evolucion,
        fecha_evolucion: ev.fecha_evolucion,
        nota_evolucion: ev.nota_evolucion,
        version: ev.version,
        profesional: p ? `${p.apellidos}, ${p.nombres}` : undefined,
      });
      evolsByConsulta.set(ev.id_consulta, list);
    }

    const tratsByConsulta = new Map<string, any[]>();
    for (const t of tratRes.data ?? []) {
      const list = tratsByConsulta.get(t.id_consulta) ?? [];
      list.push(t);
      tratsByConsulta.set(t.id_consulta, list);
    }

    const estsByConsulta = new Map<string, any[]>();
    for (const e of estRes.data ?? []) {
      const list = estsByConsulta.get(e.id_consulta) ?? [];
      list.push(e);
      estsByConsulta.set(e.id_consulta, list);
    }

    for (const row of consultasRows) {
      const esp = Array.isArray(row.especialidad) ? row.especialidad[0] : row.especialidad;
      const sal = Array.isArray(row.salita) ? row.salita[0] : row.salita;
      const prof = Array.isArray(row.profesional) ? row.profesional[0] : row.profesional;
      const rawProfPersona = (prof as any)?.persona;
      const profPersona = Array.isArray(rawProfPersona) ? rawProfPersona[0] : rawProfPersona;
      const profNombre = profPersona
        ? `${profPersona.apellidos}, ${profPersona.nombres}`
        : 'Profesional no disponible';

      consultas.push({
        id_consulta: row.id_consulta,
        fecha_atencion: row.fecha_atencion,
        fecha_firma: row.fecha_firma,
        motivo_consulta: row.motivo_consulta,
        anamnesis_cuadro_clinico: row.anamnesis_cuadro_clinico,
        examen_fisico: row.examen_fisico,
        plan_terapeutico: row.plan_terapeutico,
        especialidad: esp?.nombre ?? 'General',
        salita: sal?.nombre ?? 'Salita',
        salita_direccion: sal?.direccion ?? null,
        profesional: profNombre,
        matricula_profesional: prof?.matricula ?? null,
        diagnosticos: diagsByConsulta.get(row.id_consulta) ?? [],
        evoluciones: evolsByConsulta.get(row.id_consulta) ?? [],
        tratamientos: tratsByConsulta.get(row.id_consulta) ?? [],
        estudios: estsByConsulta.get(row.id_consulta) ?? [],
      });
    }
  }

  return {
    paciente: pacienteSummary,
    historia_clinica: {
      id_historia_clinica: hcRow.id_historia_clinica,
      numero_historia_clinica: hcRow.numero_historia_clinica,
      fecha_apertura: hcRow.fecha_apertura,
      grupo_sanguineo: hcRow.grupo_sanguineo,
      factor_rh: hcRow.factor_rh,
    },
    consultas,
    derivaciones,
    antecedentes: antecedentesRes.data ?? [],
    alergias: alergiasRes.data ?? [],
  };
};
