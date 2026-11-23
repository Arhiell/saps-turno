import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, test } from 'node:test';
import { queue, drained } from './patient-fixtures.js';

const { default: app } = await import('../src/app.js');
const { generateAccessToken } = await import('../src/services/jwt.service.js');
const { invalidatePermissionCache } = await import(
  '../src/services/permission.service.js'
);
const { CLINICAL_PERMISSIONS } = await import('../src/types/permission.types.js');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ROLE_ID = '22222222-2222-4222-8222-222222222222';
const PERSON_ID = '33333333-3333-4333-8333-333333333333';
const PATIENT_ID = '44444444-4444-4444-8444-444444444444';
const SALITA_ID = '55555555-5555-4555-8555-555555555555';
const SALITA_DESTINO_ID = '55555555-5555-4555-8555-555555555556';
const PROFESIONAL_ID = '66666666-6666-4666-8666-666666666666';
const ESPECIALIDAD_ID = '77777777-7777-4777-8777-777777777777';
const CONSULTA_ID = '88888888-8888-4888-8888-888888888888';
const EVOLUCION_ID = '99999999-9999-4999-8999-999999999999';
const ESTUDIO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DERIVACION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

interface DispatchResult {
  status: number;
  json: Record<string, any>;
}

const dispatch = (options: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<DispatchResult> =>
  new Promise((resolve, reject) => {
    const stream = new PassThrough();
    const req = new IncomingMessage(stream as unknown as Socket);
    req.method = options.method;
    req.url = options.url;
    req.headers = {
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...Object.fromEntries(
        Object.entries(options.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])
      ),
    };

    if (options.body !== undefined) {
      const payload = Buffer.from(JSON.stringify(options.body), 'utf8');
      req.headers['content-length'] = String(payload.length);
      req.push(payload);
    }
    req.push(null);

    const res = new ServerResponse(req);
    const chunks: Buffer[] = [];
    let settled = false;

    const finishResponse = () => {
      if (settled) return;
      settled = true;
      stream.destroy();
      const rawBody = Buffer.concat(chunks).toString('utf8');
      let parsed: Record<string, any> = {};
      if (rawBody) {
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          parsed = { rawBody };
        }
      }
      resolve({ status: res.statusCode, json: parsed });
    };

    res.write = ((chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    }) as typeof res.write;

    res.end = ((chunk?: Buffer | string, ...rest: unknown[]) => {
      if (chunk && typeof chunk !== 'function') {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const maybeCb = rest.find((arg) => typeof arg === 'function') as
        | (() => void)
        | undefined;
      if (typeof chunk === 'function') {
        (chunk as () => void)();
      } else {
        maybeCb?.();
      }
      queueMicrotask(finishResponse);
      return res;
    }) as typeof res.end;

    try {
      (app as unknown as (r: IncomingMessage, s: ServerResponse) => void)(req, res);
    } catch (err) {
      stream.destroy();
      reject(err);
    }
  });

const makeToken = (rol = 'PROFESIONAL') =>
  generateAccessToken({
    id_usuario: USER_ID,
    email: 'pro@saps.test',
    nombre_usuario: 'profesional.test',
    rol,
  });

const authSteps = (rol = 'PROFESIONAL') => [
  {
    table: 'usuarios',
    result: [
      {
        id_usuario: USER_ID,
        id_rol: ROLE_ID,
        id_persona: PERSON_ID,
        nombre_usuario: 'profesional.test',
        email: 'pro@saps.test',
        email_verificado: true,
        activo: true,
      },
    ],
  },
  {
    table: 'roles',
    result: [{ id_rol: ROLE_ID, codigo: rol, nombre: rol, activo: true }],
  },
];

const rolePermissionsStep = (rol: string, permisos: string[]) => ({
  table: 'roles',
  result: [
    {
      id_rol: ROLE_ID,
      codigo: rol,
      activo: true,
      rol_permisos: permisos.map((codigo) => ({
        permiso: { codigo, activo: true },
      })),
    },
  ],
});

const profesionalSalitaSteps = (vigente = true) => [
  {
    table: 'profesionales',
    result: [{ id_profesional: PROFESIONAL_ID }],
  },
  {
    table: 'profesional_salita',
    result: vigente ? [{ id_salita: SALITA_ID }] : [],
  },
];

const scopeOkStep = (via = 'SALITA_ASIGNADA', alcance = 'SALITA_ASIGNADA') => ({
  table: 'rpc/verificar_acceso_clinico',
  method: 'POST',
  result: {
    autorizado: true,
    id_profesional: PROFESIONAL_ID,
    id_salita_paciente: SALITA_ID,
    via,
    alcance,
    id_derivacion: via === 'DERIVACION_AUTORIZADA' ? DERIVACION_ID : null,
    id_especialidad_autorizada: null,
    fecha_acceso: '2026-11-10',
    fecha_desde_autorizada: null,
    fecha_hasta_autorizada: null,
  },
});

const CLINICAL_ASSIST_PERMS = [
  CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA,
  CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA,
  CLINICAL_PERMISSIONS.GESTIONAR_ANTECEDENTES_CLINICOS,
  CLINICAL_PERMISSIONS.REGISTRAR_DIAGNOSTICOS,
  CLINICAL_PERMISSIONS.REGISTRAR_EVOLUCIONES,
  CLINICAL_PERMISSIONS.GESTIONAR_TRATAMIENTOS,
  CLINICAL_PERMISSIONS.GESTIONAR_ESTUDIOS_CLINICOS,
  CLINICAL_PERMISSIONS.GESTIONAR_DERIVACIONES_CLINICAS,
];

beforeEach(() => {
  invalidatePermissionCache();
});

afterEach(() => {
  invalidatePermissionCache();
  drained();
});

test('1. Profesional con permiso y alcance válido consulta historia clínica, antecedentes y alergias con auditoría', async () => {
  const token = await makeToken('PROFESIONAL');
  const mockHistoria = {
    historia_clinica: { id_historia_clinica: CONSULTA_ID, estado: 'ACTIVA' },
    paciente: { id_paciente: PATIENT_ID, dni: '40111222' },
    via_acceso: 'SALITA_ASIGNADA',
    alcance: 'SALITA_ASIGNADA',
    id_derivacion: null,
    contenido_restringido_por_alcance: false,
    antecedentes: [
      { id_antecedente: CONSULTA_ID, tipo: 'PERSONAL', estado: 'ACTIVO', descripcion: 'Hipertensión' },
      { id_antecedente: EVOLUCION_ID, tipo: 'FAMILIAR', estado: 'RESUELTO', descripcion: 'Diabetes' },
    ],
    alergias: [
      { id_alergia: ESTUDIO_ID, alergeno: 'Penicilina', estado: 'ACTIVA', gravedad: 'GRAVE' },
    ],
    consultas: [],
  };

  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', CLINICAL_ASSIST_PERMS),
    scopeOkStep(),
    {
      table: 'rpc/consultar_historia_clinica',
      method: 'POST',
      result: mockHistoria,
      check: (_url, body) => {
        assert.equal(body?.p_usuario, USER_ID);
        assert.equal(body?.p_paciente, PATIENT_ID);
        assert.equal(body?.p_salita, SALITA_ID);
        assert.equal(body?.p_es_exportacion, true);
        assert.equal(body?.p_motivo_acceso, 'Resumen de derivación');
      },
    }
  );

  const hcRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}&es_exportacion=true&motivo_acceso=Resumen%20de%20derivaci%C3%B3n`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(hcRes.status, 200);
  assert.equal(hcRes.json.success, true);
  assert.equal(hcRes.json.data.antecedentes.length, 2);
  drained();

  // Antecedentes filtrados por tipo (usa caché de permisos)
  queue(...authSteps('PROFESIONAL'), scopeOkStep(), {
    table: 'rpc/consultar_historia_clinica',
    method: 'POST',
    result: mockHistoria,
  });
  const antRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}/antecedentes?id_salita=${SALITA_ID}&tipo=PERSONAL`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(antRes.status, 200);
  assert.equal(antRes.json.data.antecedentes.length, 1);
  assert.equal(antRes.json.data.antecedentes[0].tipo, 'PERSONAL');
  drained();

  // Alergias
  queue(...authSteps('PROFESIONAL'), scopeOkStep(), {
    table: 'rpc/consultar_historia_clinica',
    method: 'POST',
    result: mockHistoria,
  });
  const algRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}/alergias?id_salita=${SALITA_ID}&estado=ACTIVA`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(algRes.status, 200);
  assert.equal(algRes.json.data.alergias.length, 1);
});

test('2. Consulta individual y secciones (diagnosticos, evoluciones, tratamientos, estudios) + protección de borradores ajenos', async () => {
  const token = await makeToken('PROFESIONAL');
  const mockConsulta = {
    id_consulta: CONSULTA_ID,
    id_paciente: PATIENT_ID,
    id_salita: SALITA_ID,
    estado: 'FIRMADA',
    via_acceso: 'SALITA_ASIGNADA',
    alcance: 'SALITA_ASIGNADA',
    id_derivacion: null,
    diagnosticos: [{ id_diagnostico: DERIVACION_ID, descripcion: 'Faringitis aguda' }],
    evoluciones: [{ id_evolucion: EVOLUCION_ID, version: 1, estado: 'FIRMADA' }],
    tratamientos: [{ id_tratamiento: ESTUDIO_ID, medicacion: 'Ibuprofeno 400mg' }],
    estudios: [{ id_estudio: ESTUDIO_ID, tipo_estudio: 'Laboratorio', estado: 'SOLICITADO' }],
  };

  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', CLINICAL_ASSIST_PERMS),
    ...profesionalSalitaSteps(true),
    {
      table: 'rpc/consultar_consulta_medica',
      method: 'POST',
      result: mockConsulta,
      check: (_url, body) => {
        assert.equal(body?.p_usuario, USER_ID);
        assert.equal(body?.p_consulta, CONSULTA_ID);
        assert.equal(body?.p_salita, SALITA_ID);
      },
    }
  );
  const fullRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/consultas/${CONSULTA_ID}?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(fullRes.status, 200);
  assert.equal(fullRes.json.data.diagnosticos.length, 1);
  drained();

  for (const section of ['diagnosticos', 'evoluciones', 'tratamientos', 'estudios']) {
    queue(...authSteps('PROFESIONAL'), ...profesionalSalitaSteps(true), {
      table: 'rpc/consultar_consulta_medica',
      method: 'POST',
      result: mockConsulta,
    });
    const secRes = await dispatch({
      method: 'GET',
      url: `/api/historia-clinica/consultas/${CONSULTA_ID}/${section}?id_salita=${SALITA_ID}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(secRes.status, 200);
    assert.equal(secRes.json.data[section].length, 1);
    drained();
  }

  // Borrador ajeno rechazado por la RPC con 42501 -> 403
  queue(...authSteps('PROFESIONAL'), ...profesionalSalitaSteps(true), {
    table: 'rpc/consultar_consulta_medica',
    method: 'POST',
    status: 403,
    result: {
      code: '42501',
      message: 'Los borradores clínicos solo pueden ser consultados por su profesional autor',
    },
  });
  const draftRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/consultas/${CONSULTA_ID}?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(draftRes.status, 403);
});

test('3. Bloqueo de pacientes fuera del alcance, profesionales sin vigencia y derivaciones vencidas o revocadas', async () => {
  const token = await makeToken('PROFESIONAL');

  // 3a. Paciente fuera de alcance / derivación vencida o revocada
  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', CLINICAL_ASSIST_PERMS),
    {
      table: 'rpc/verificar_acceso_clinico',
      method: 'POST',
      status: 403,
      result: {
        code: '42501',
        message: 'Sin autorización o derivación vigente compatible con el alcance, especialidad y fecha requeridos',
      },
    }
  );
  const outOfScopeRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(outOfScopeRes.status, 403);
  drained();

  // 3b. Profesional sin asociación vigente en la salita en endpoint de recurso
  queue(...authSteps('PROFESIONAL'), ...profesionalSalitaSteps(false));
  const noSalitaRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/consultas/${CONSULTA_ID}?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(noSalitaRes.status, 403);
  drained();

  // 3c. Derivación en estado definitivo (REVOCADA / VENCIDA) -> 409
  queue(...authSteps('PROFESIONAL'), ...profesionalSalitaSteps(true), {
    table: 'rpc/resolver_derivacion_clinica',
    method: 'POST',
    status: 400,
    result: {
      code: 'P0001',
      message: 'Una derivación en estado REVOCADA es definitiva y no admite modificaciones',
    },
  });
  const revokedRes = await dispatch({
    method: 'PATCH',
    url: `/api/historia-clinica/derivaciones/${DERIVACION_ID}/resolver`,
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id_salita: SALITA_ID,
      nuevo_estado: 'AUTORIZADA',
    },
  });
  assert.equal(revokedRes.status, 409);
});

test('4. Bloqueo de administradores (SUPER_ADMIN, ADMIN_SALITA, RECEPCION) sin permisos clínicos o sin perfil asistencial', async () => {
  for (const rol of ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION']) {
    invalidatePermissionCache();
    const token = await makeToken(rol);

    queue(
      ...authSteps(rol),
      rolePermissionsStep(rol, ['GESTIONAR_PACIENTES', 'VER_AUDITORIA'])
    );
    const res = await dispatch({
      method: 'GET',
      url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 403);
    drained();
  }
});

test('5. Registro transaccional compuesto de consulta médica y validación de sub-permisos', async () => {
  const token = await makeToken('PROFESIONAL');

  // 5a. Profesional con CREAR_CONSULTA_CLINICA pero SIN REGISTRAR_DIAGNOSTICOS falla al enviar diagnosticos
  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', [CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA]),
    scopeOkStep()
  );
  const missingSubPermRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      motivo_consulta: 'Control general',
      diagnosticos: [{ descripcion: 'Rinitis alérgica', tipo: 'PRESUNTIVO' }],
    },
  });
  assert.equal(missingSubPermRes.status, 403);
  drained();

  // 5b. Profesional con todos los permisos crea consulta compuesta con antecedentes, alergias, diagnósticos, tratamientos y estudios
  invalidatePermissionCache();
  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', CLINICAL_ASSIST_PERMS),
    scopeOkStep(),
    {
      table: 'rpc/registrar_consulta_clinica',
      method: 'POST',
      result: {
        id_historia_clinica: PATIENT_ID,
        id_consulta: CONSULTA_ID,
        estado: 'BORRADOR',
        id_profesional: PROFESIONAL_ID,
        via_acceso: 'SALITA_ASIGNADA',
        alcance: 'SALITA_ASIGNADA',
        id_derivacion: null,
      },
      check: (_url, body) => {
        assert.equal(body?.p_usuario, USER_ID);
        assert.equal(body?.p_salita, SALITA_ID);
        const pDatos = body?.p_datos as Record<string, any>;
        assert.equal(pDatos.id_paciente, PATIENT_ID);
        assert.equal(pDatos.diagnosticos.length, 1);
        assert.equal(pDatos.antecedentes.length, 1);
        assert.equal(pDatos.alergias.length, 1);
        assert.equal(pDatos.tratamientos.length, 1);
        assert.equal(pDatos.estudios.length, 1);
      },
    }
  );

  const createdRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      motivo_consulta: 'Control clínico integral',
      firmar: false,
      diagnosticos: [{ codigo: 'J00', descripcion: 'Rinofaringitis aguda', tipo: 'CONFIRMADO' }],
      antecedentes: [{ tipo: 'PERSONAL', descripcion: 'Asma infantil' }],
      alergias: [{ alergeno: 'Dipirona', tipo_reaccion: 'Urticaria', gravedad: 'MODERADA' }],
      tratamientos: [{ medicacion: 'Salbutamol', dosis: '2 puffs', frecuencia: 'cada 8h' }],
      estudios: [{ tipo_estudio: 'Espirometría', descripcion: 'Control basal' }],
    },
  });
  assert.equal(createdRes.status, 201);
  assert.equal(createdRes.json.data.id_consulta, CONSULTA_ID);
});

test('6. Firma, anulación de borrador, evolución, rectificación trazable, estudios y restricciones de inmutabilidad', async () => {
  const token = await makeToken('PROFESIONAL');

  // Firmar consulta
  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', CLINICAL_ASSIST_PERMS),
    ...profesionalSalitaSteps(true),
    {
      table: 'rpc/firmar_consulta_medica',
      method: 'POST',
      result: { id_consulta: CONSULTA_ID, estado: 'FIRMADA' },
    }
  );
  const firmarRes = await dispatch({
    method: 'POST',
    url: `/api/historia-clinica/consultas/${CONSULTA_ID}/firmar`,
    headers: { Authorization: `Bearer ${token}` },
    body: { id_salita: SALITA_ID },
  });
  assert.equal(firmarRes.status, 200);
  assert.equal(firmarRes.json.data.estado, 'FIRMADA');
  drained();

  // Anular consulta ya firmada -> RPC rechaza con 22023 -> 400
  queue(...authSteps('PROFESIONAL'), ...profesionalSalitaSteps(true), {
    table: 'rpc/anular_consulta_borrador',
    method: 'POST',
    status: 400,
    result: {
      code: '22023',
      message: 'Solo pueden anularse consultas en estado BORRADOR',
    },
  });
  const anularFirmadaRes = await dispatch({
    method: 'POST',
    url: `/api/historia-clinica/consultas/${CONSULTA_ID}/anular`,
    headers: { Authorization: `Bearer ${token}` },
    body: { id_salita: SALITA_ID, motivo_anulacion: 'Error de carga' },
  });
  assert.equal(anularFirmadaRes.status, 400);
  drained();

  // Registrar evolución sobre consulta firmada -> 201
  queue(...authSteps('PROFESIONAL'), ...profesionalSalitaSteps(true), {
    table: 'rpc/registrar_evolucion_clinica',
    method: 'POST',
    result: { id_evolucion: EVOLUCION_ID, estado: 'FIRMADA' },
  });
  const evoRes = await dispatch({
    method: 'POST',
    url: `/api/historia-clinica/consultas/${CONSULTA_ID}/evoluciones`,
    headers: { Authorization: `Bearer ${token}` },
    body: { id_salita: SALITA_ID, evolucion: 'Paciente evoluciona favorablemente' },
  });
  assert.equal(evoRes.status, 201);
  drained();

  // Rectificar evolución -> 200
  queue(...authSteps('PROFESIONAL'), ...profesionalSalitaSteps(true), {
    table: 'rpc/rectificar_evolucion_clinica',
    method: 'POST',
    result: {
      id_evolucion_anterior: EVOLUCION_ID,
      id_evolucion_nueva: DERIVACION_ID,
      version: 2,
    },
  });
  const rectRes = await dispatch({
    method: 'POST',
    url: `/api/historia-clinica/evoluciones/${EVOLUCION_ID}/rectificar`,
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id_salita: SALITA_ID,
      nueva_evolucion: 'Paciente con mejoría parcial, continúa tratamiento',
      motivo_correccion: 'Aclaración clínica de seguimiento',
    },
  });
  assert.equal(rectRes.status, 200);
  assert.equal(rectRes.json.data.version, 2);
  drained();

  // Actualizar estado estudio e informar estudio
  queue(...authSteps('PROFESIONAL'), ...profesionalSalitaSteps(true), {
    table: 'rpc/actualizar_estado_estudio_clinico',
    method: 'POST',
    result: { id_estudio: ESTUDIO_ID, estado: 'EN_PROCESO' },
  });
  const estEstadoRes = await dispatch({
    method: 'PATCH',
    url: `/api/historia-clinica/estudios/${ESTUDIO_ID}/estado`,
    headers: { Authorization: `Bearer ${token}` },
    body: { id_salita: SALITA_ID, nuevo_estado: 'EN_PROCESO' },
  });
  assert.equal(estEstadoRes.status, 200);
  drained();

  queue(...authSteps('PROFESIONAL'), ...profesionalSalitaSteps(true), {
    table: 'rpc/informar_estudio_clinico',
    method: 'POST',
    result: { id_estudio: ESTUDIO_ID, estado: 'COMPLETADO' },
  });
  const estInfRes = await dispatch({
    method: 'POST',
    url: `/api/historia-clinica/estudios/${ESTUDIO_ID}/informar`,
    headers: { Authorization: `Bearer ${token}` },
    body: { id_salita: SALITA_ID, resultado: 'Valores dentro de parámetros normales' },
  });
  assert.equal(estInfRes.status, 200);
  assert.equal(estInfRes.json.data.estado, 'COMPLETADO');
});

test('7. Derivaciones y auditoría clínica: solicitud, listado, resolución y control de VER_AUDITORIA_CLINICA', async () => {
  const proToken = await makeToken('PROFESIONAL');

  // Solicitar derivación
  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', CLINICAL_ASSIST_PERMS),
    scopeOkStep(),
    {
      table: 'rpc/solicitar_derivacion_clinica',
      method: 'POST',
      result: {
        id_derivacion: DERIVACION_ID,
        tipo: 'DERIVACION',
        alcance: 'ESPECIALIDAD',
        estado: 'PENDIENTE',
      },
    }
  );
  const solRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/derivaciones',
    headers: { Authorization: `Bearer ${proToken}` },
    body: {
      id_salita: SALITA_ID,
      id_paciente: PATIENT_ID,
      id_salita_destino: SALITA_DESTINO_ID,
      tipo: 'DERIVACION',
      alcance: 'ESPECIALIDAD',
      id_especialidad_destino: ESPECIALIDAD_ID,
      motivo: 'Interconsulta cardiológica programada',
      fecha_hasta: '2026-12-31',
    },
  });
  assert.equal(solRes.status, 201);
  drained();

  // Listar derivaciones
  queue(...authSteps('PROFESIONAL'), ...profesionalSalitaSteps(true), {
    table: 'rpc/listar_derivaciones_clinicas',
    method: 'POST',
    result: [{ id_derivacion: DERIVACION_ID, estado: 'PENDIENTE' }],
  });
  const listDerRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/derivaciones?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${proToken}` },
  });
  assert.equal(listDerRes.status, 200);
  assert.equal(listDerRes.json.data.length, 1);
  drained();

  // Profesional sin VER_AUDITORIA_CLINICA no puede consultar auditoría -> 403
  queue(...authSteps('PROFESIONAL'));
  const auditDeniedRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/auditoria?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${proToken}` },
  });
  assert.equal(auditDeniedRes.status, 403);
  drained();

  // Usuario con VER_AUDITORIA_CLINICA consulta auditoría clínica -> 200
  invalidatePermissionCache();
  const auditToken = await makeToken('SUPER_ADMIN');
  queue(
    ...authSteps('SUPER_ADMIN'),
    rolePermissionsStep('SUPER_ADMIN', [CLINICAL_PERMISSIONS.VER_AUDITORIA_CLINICA]),
    {
      table: 'rpc/consultar_auditoria_clinica',
      method: 'POST',
      result: [{ id_auditoria_clinica: 1, tipo_operacion: 'CONSULTA' }],
      check: (_url, body) => {
        assert.equal(body?.p_usuario, USER_ID);
        assert.equal(body?.p_limit, 25);
      },
    }
  );
  const auditOkRes = await dispatch({
    method: 'GET',
    url: '/api/historia-clinica/auditoria?limit=25&offset=0',
    headers: { Authorization: `Bearer ${auditToken}` },
  });
  assert.equal(auditOkRes.status, 200);
  assert.equal(auditOkRes.json.data.length, 1);
});

test('8. Rechazo de datos de identidad enviados por cliente, validaciones Zod y errores controlados de RPC', async () => {
  const token = await makeToken('PROFESIONAL');

  // 8a. Cliente envía id_usuario / id_profesional / rol en body -> rechazado por Zod .strict() (400)
  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', CLINICAL_ASSIST_PERMS),
    scopeOkStep()
  );
  const spoofBodyRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      motivo_consulta: 'Intento de suplantación',
      id_usuario: '99999999-9999-4999-8999-999999999999',
      id_profesional: '99999999-9999-4999-8999-999999999999',
      rol: 'SUPER_ADMIN',
    },
  });
  assert.equal(spoofBodyRes.status, 400);
  drained();

  // 8b. Cliente envía id_usuario en query -> rechazado por Zod .strict() (400)
  queue(...authSteps('PROFESIONAL'), scopeOkStep());
  const spoofQueryRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}&id_usuario=${USER_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(spoofQueryRes.status, 400);
  drained();

  // 8c. Derivación con misma salita origen/destino o rechazo sin motivo -> 400
  queue(...authSteps('PROFESIONAL'), scopeOkStep());
  const sameSalitaDerRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/derivaciones',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id_salita: SALITA_ID,
      id_paciente: PATIENT_ID,
      id_salita_destino: SALITA_ID,
      tipo: 'DERIVACION',
      alcance: 'ESPECIALIDAD',
      id_especialidad_destino: ESPECIALIDAD_ID,
      motivo: 'Motivo válido de prueba',
      fecha_hasta: '2026-12-31',
    },
  });
  assert.equal(sameSalitaDerRes.status, 400);
  drained();

  queue(...authSteps('PROFESIONAL'), ...profesionalSalitaSteps(true));
  const rejectNoMotivoRes = await dispatch({
    method: 'PATCH',
    url: `/api/historia-clinica/derivaciones/${DERIVACION_ID}/resolver`,
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id_salita: SALITA_ID,
      nuevo_estado: 'RECHAZADA',
    },
  });
  assert.equal(rejectNoMotivoRes.status, 400);
  drained();

  // 8d. Error inesperado de RPC responde 500 controlado sin exponer detalles internos
  queue(...authSteps('PROFESIONAL'), ...profesionalSalitaSteps(true), {
    table: 'rpc/consultar_consulta_medica',
    method: 'POST',
    status: 500,
    result: { message: 'secret postgres stack trace with SUPABASE_SECRET_KEY' },
  });
  const rpcErrRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/consultas/${CONSULTA_ID}?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(rpcErrRes.status, 500);
  assert.equal(rpcErrRes.json.message, 'Error interno del servidor');
  assert.equal(JSON.stringify(rpcErrRes.json).includes('postgres'), false);
});

test('9. Exportación sin motivo usa motivo predeterminado específico de exportación', async () => {
  const token = await makeToken('PROFESIONAL');
  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', CLINICAL_ASSIST_PERMS),
    scopeOkStep(),
    {
      table: 'rpc/consultar_historia_clinica',
      method: 'POST',
      result: {
        historia_clinica: null,
        paciente: { id_paciente: PATIENT_ID },
        via_acceso: 'SALITA_ASIGNADA',
        alcance: 'SALITA_ASIGNADA',
        id_derivacion: null,
        contenido_restringido_por_alcance: false,
        antecedentes: [],
        alergias: [],
        consultas: [],
      },
      check: (_url, body) => {
        assert.equal(body?.p_es_exportacion, true);
        assert.equal(body?.p_motivo_acceso, 'Exportación de historia clínica');
      },
    }
  );

  const exportRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}&es_exportacion=true`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(exportRes.status, 200);
  drained();

  // Consulta normal sin motivo mantiene el motivo predeterminado de consulta
  queue(...authSteps('PROFESIONAL'), scopeOkStep(), {
    table: 'rpc/consultar_historia_clinica',
    method: 'POST',
    result: {
      historia_clinica: null,
      paciente: { id_paciente: PATIENT_ID },
      via_acceso: 'SALITA_ASIGNADA',
      alcance: 'SALITA_ASIGNADA',
      id_derivacion: null,
      contenido_restringido_por_alcance: false,
      antecedentes: [],
      alergias: [],
      consultas: [],
    },
    check: (_url, body) => {
      assert.equal(body?.p_es_exportacion, false);
      assert.equal(body?.p_motivo_acceso, 'Consulta de historia clínica');
    },
  });

  const readRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(readRes.status, 200);
});

test('10. Auditoría clínica normaliza fecha_hasta YYYY-MM-DD a fin de día -03:00 y conserva hora explícita', async () => {
  const auditToken = await makeToken('SUPER_ADMIN');

  // Caso A: fecha_hasta YYYY-MM-DD con fecha_desde con hora en el mismo día
  queue(
    ...authSteps('SUPER_ADMIN'),
    rolePermissionsStep('SUPER_ADMIN', [CLINICAL_PERMISSIONS.VER_AUDITORIA_CLINICA]),
    {
      table: 'rpc/consultar_auditoria_clinica',
      method: 'POST',
      result: [],
      check: (_url, body) => {
        assert.equal(body?.p_fecha_desde, '2026-11-10T15:00:00-03:00');
        assert.equal(body?.p_fecha_hasta, '2026-11-10T23:59:59.999-03:00');
      },
    }
  );
  const dateOnlyRes = await dispatch({
    method: 'GET',
    url: '/api/historia-clinica/auditoria?fecha_desde=2026-11-10T15:00:00-03:00&fecha_hasta=2026-11-10',
    headers: { Authorization: `Bearer ${auditToken}` },
  });
  assert.equal(dateOnlyRes.status, 200);
  drained();

  // Caso B: fecha_hasta con hora explícita se mantiene intacta
  queue(...authSteps('SUPER_ADMIN'), {
    table: 'rpc/consultar_auditoria_clinica',
    method: 'POST',
    result: [],
    check: (_url, body) => {
      assert.equal(body?.p_fecha_desde, '2026-11-10T08:00:00-03:00');
      assert.equal(body?.p_fecha_hasta, '2026-11-10T18:30:00-03:00');
    },
  });
  const explicitTimeRes = await dispatch({
    method: 'GET',
    url: '/api/historia-clinica/auditoria?fecha_desde=2026-11-10T08:00:00-03:00&fecha_hasta=2026-11-10T18:30:00-03:00',
    headers: { Authorization: `Bearer ${auditToken}` },
  });
  assert.equal(explicitTimeRes.status, 200);
});

test('11. ADMIN_SALITA en derivaciones: solo resuelve con permiso en su salita vigente y sin acceso clínico ni solicitud profesional', async () => {
  const adminToken = await makeToken('ADMIN_SALITA');

  // 11a. Sin GESTIONAR_DERIVACIONES_CLINICAS en rol_permisos -> 403
  queue(
    ...authSteps('ADMIN_SALITA'),
    rolePermissionsStep('ADMIN_SALITA', ['GESTIONAR_PACIENTES', 'GESTIONAR_TURNOS'])
  );
  const withoutPermRes = await dispatch({
    method: 'PATCH',
    url: `/api/historia-clinica/derivaciones/${DERIVACION_ID}/resolver`,
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { id_salita: SALITA_ID, nuevo_estado: 'AUTORIZADA' },
  });
  assert.equal(withoutPermRes.status, 403);
  drained();

  // 11b. Con GESTIONAR_DERIVACIONES_CLINICAS, otra salita fuera de usuario_salita -> 403 antes de RPC
  invalidatePermissionCache();
  queue(
    ...authSteps('ADMIN_SALITA'),
    rolePermissionsStep('ADMIN_SALITA', [
      CLINICAL_PERMISSIONS.GESTIONAR_DERIVACIONES_CLINICAS,
    ]),
    { table: 'usuario_salita', result: [] }
  );
  const wrongSalitaRes = await dispatch({
    method: 'PATCH',
    url: `/api/historia-clinica/derivaciones/${DERIVACION_ID}/resolver`,
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { id_salita: SALITA_DESTINO_ID, nuevo_estado: 'AUTORIZADA' },
  });
  assert.equal(wrongSalitaRes.status, 403);
  drained();

  // 11c. Con GESTIONAR_DERIVACIONES_CLINICAS y usuario_salita vigente -> resuelve derivación (200)
  queue(
    ...authSteps('ADMIN_SALITA'),
    { table: 'usuario_salita', result: [{ id_salita: SALITA_DESTINO_ID }] },
    {
      table: 'rpc/resolver_derivacion_clinica',
      method: 'POST',
      result: { id_derivacion: DERIVACION_ID, estado: 'AUTORIZADA' },
      check: (_url, body) => {
        assert.equal(body?.p_usuario, USER_ID);
        assert.equal(body?.p_salita, SALITA_DESTINO_ID);
        assert.equal(body?.p_nuevo_estado, 'AUTORIZADA');
      },
    }
  );
  const resolveOkRes = await dispatch({
    method: 'PATCH',
    url: `/api/historia-clinica/derivaciones/${DERIVACION_ID}/resolver`,
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { id_salita: SALITA_DESTINO_ID, nuevo_estado: 'AUTORIZADA' },
  });
  assert.equal(resolveOkRes.status, 200);
  drained();

  // 11d. Incluso con GESTIONAR_DERIVACIONES_CLINICAS, ADMIN_SALITA sigue bloqueado para solicitar derivación o leer HC (403)
  queue(...authSteps('ADMIN_SALITA'));
  const solicitBlockedRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/derivaciones',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      id_salita: SALITA_ID,
      id_paciente: PATIENT_ID,
      id_salita_destino: SALITA_DESTINO_ID,
      tipo: 'DERIVACION',
      alcance: 'ESPECIALIDAD',
      id_especialidad_destino: ESPECIALIDAD_ID,
      motivo: 'Intento administrativo no asistencial',
      fecha_hasta: '2026-12-31',
    },
  });
  assert.equal(solicitBlockedRes.status, 403);
  drained();

  queue(...authSteps('ADMIN_SALITA'));
  const hcBlockedRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(hcBlockedRes.status, 403);
});

test('12. Bloqueo de PACIENTE, anulación de borrador, inexistencia de edición directa y rechazo de identificadores manipulados', async () => {
  // 12a. PACIENTE no tiene acceso a endpoints clínicos internos ni auditoría (403)
  const pacienteToken = await makeToken('PACIENTE');
  for (const endpoint of [
    `/api/historia-clinica/pacientes?id_salita=${SALITA_ID}`,
    `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
    `/api/historia-clinica/consultas/${CONSULTA_ID}?id_salita=${SALITA_ID}`,
    `/api/historia-clinica/derivaciones?id_salita=${SALITA_ID}`,
    '/api/historia-clinica/auditoria',
  ]) {
    invalidatePermissionCache();
    queue(...authSteps('PACIENTE'), rolePermissionsStep('PACIENTE', []));
    const res = await dispatch({
      method: 'GET',
      url: endpoint,
      headers: { Authorization: `Bearer ${pacienteToken}` },
    });
    assert.equal(res.status, 403);
    drained();
  }

  // 12b. Anulación exitosa de consulta en estado BORRADOR (200)
  invalidatePermissionCache();
  const profToken = await makeToken('PROFESIONAL');
  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', CLINICAL_ASSIST_PERMS),
    ...profesionalSalitaSteps(true),
    {
      table: 'rpc/anular_consulta_borrador',
      method: 'POST',
      result: { id_consulta: CONSULTA_ID, estado: 'ANULADA' },
      check: (_url, body) => {
        assert.equal(body?.p_id_consulta, CONSULTA_ID);
        assert.equal(body?.p_salita, SALITA_ID);
        assert.equal(body?.p_usuario, USER_ID);
      },
    }
  );
  const anularDraftRes = await dispatch({
    method: 'POST',
    url: `/api/historia-clinica/consultas/${CONSULTA_ID}/anular`,
    headers: { Authorization: `Bearer ${profToken}` },
    body: { id_salita: SALITA_ID, motivo_anulacion: 'Carga en borrador duplicada' },
  });
  assert.equal(anularDraftRes.status, 200);
  assert.equal(anularDraftRes.json.data.estado, 'ANULADA');
  drained();

  // 12c. PUT no existe (404) y PATCH sobre consulta FIRMADA/ANULADA es rechazado (409 inmutable)
  queue(...authSteps('PROFESIONAL'));
  const putRes = await dispatch({
    method: 'PUT',
    url: `/api/historia-clinica/consultas/${CONSULTA_ID}`,
    headers: { Authorization: `Bearer ${profToken}` },
    body: { id_salita: SALITA_ID, motivo_consulta: 'Intento de edición directa' },
  });
  assert.equal(putRes.status, 404);
  drained();

  queue(
    ...authSteps('PROFESIONAL'),
    ...profesionalSalitaSteps(true),
    {
      table: 'rpc/actualizar_consulta_borrador',
      method: 'POST',
      status: 400,
      result: {
        code: 'P0001',
        message: 'Una consulta médica en estado FIRMADA es inmutable y no admite modificaciones directas',
      },
    }
  );
  const patchRes = await dispatch({
    method: 'PATCH',
    url: `/api/historia-clinica/consultas/${CONSULTA_ID}`,
    headers: { Authorization: `Bearer ${profToken}` },
    body: { id_salita: SALITA_ID, motivo_consulta: 'Intento de edición directa' },
  });
  assert.equal(patchRes.status, 409);
  drained();

  // 12d. Identificador de paciente manipulado / incompatible con turno es rechazado por Zod o RPC
  queue(...authSteps('PROFESIONAL'));
  const badPatientUuidRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_paciente: 'otro-paciente-manipulado',
      id_salita: SALITA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      motivo_consulta: 'Prueba de payload manipulado',
    },
  });
  assert.equal(badPatientUuidRes.status, 400);
  drained();

  queue(
    ...authSteps('PROFESIONAL'),
    scopeOkStep(),
    {
      table: 'rpc/registrar_consulta_clinica',
      method: 'POST',
      status: 400,
      result: {
        code: '22023',
        message: 'El turno indicado no corresponde al paciente seleccionado',
      },
    }
  );
  const mismatchPatientTurnoRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      id_turno: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      motivo_consulta: 'Intento de vincular turno de otro paciente',
    },
  });
  assert.equal(mismatchPatientTurnoRes.status, 400);
});

test('13. Borrador temporal de formulario: guardado, recuperación, conflicto optimista 409, descarte y fallback RPC', async () => {
  const profToken = await makeToken('PROFESIONAL');
  invalidatePermissionCache();

  // 13a. Guardar borrador temporal inicial (version_esperada = 0 -> devuelve version 1)
  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', CLINICAL_ASSIST_PERMS),
    scopeOkStep(),
    {
      table: 'rpc/guardar_borrador_formulario_clinico',
      method: 'POST',
      result: {
        id_borrador: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        id_paciente: PATIENT_ID,
        id_salita: SALITA_ID,
        id_especialidad: ESPECIALIDAD_ID,
        id_turno: null,
        datos_formulario: { motivo_consulta: 'Control febril parcial' },
        version: 1,
        fecha_preparacion: '2026-11-10',
        fecha_actualizacion: '2026-11-10T18:05:00.000Z',
      },
      check: (_url, body) => {
        assert.equal(body?.p_usuario, USER_ID);
        assert.equal(body?.p_paciente, PATIENT_ID);
        assert.equal(body?.p_version_esperada, 0);
      },
    }
  );
  const saveRes = await dispatch({
    method: 'PUT',
    url: '/api/historia-clinica/borradores-temporales',
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      version_esperada: 0,
      datos_formulario: { motivo_consulta: 'Control febril parcial' },
    },
  });
  assert.equal(saveRes.status, 200);
  assert.equal(saveRes.json.data.available, true);
  assert.equal(saveRes.json.data.borrador.version, 1);
  drained();

  // 13b. Recuperar borrador tras recarga
  queue(
    ...authSteps('PROFESIONAL'),
    scopeOkStep(),
    {
      table: 'rpc/obtener_borrador_formulario_clinico',
      method: 'POST',
      result: {
        id_borrador: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        id_paciente: PATIENT_ID,
        id_salita: SALITA_ID,
        id_especialidad: ESPECIALIDAD_ID,
        id_turno: null,
        datos_formulario: { motivo_consulta: 'Control febril parcial' },
        version: 1,
        fecha_preparacion: '2026-11-10',
        fecha_actualizacion: '2026-11-10T18:05:00.000Z',
      },
    }
  );
  const getRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/borradores-temporales?id_paciente=${PATIENT_ID}&id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${profToken}` },
  });
  assert.equal(getRes.status, 200);
  assert.equal(
    getRes.json.data.borrador.datos_formulario.motivo_consulta,
    'Control febril parcial'
  );
  drained();

  // 13c. Conflicto optimista entre pestañas (version_esperada obsoleta -> 409 + borrador_actual)
  queue(
    ...authSteps('PROFESIONAL'),
    scopeOkStep(),
    {
      table: 'rpc/guardar_borrador_formulario_clinico',
      method: 'POST',
      status: 409,
      result: {
        code: '40001',
        message: 'CONFLICTO_VERSION_BORRADOR: El borrador fue actualizado en otra pestaña',
      },
    },
    {
      table: 'rpc/obtener_borrador_formulario_clinico',
      method: 'POST',
      result: {
        id_borrador: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        id_paciente: PATIENT_ID,
        id_salita: SALITA_ID,
        version: 2,
        datos_formulario: { motivo_consulta: 'Editado desde pestaña 2' },
        fecha_actualizacion: '2026-11-10T18:06:00.000Z',
      },
    }
  );
  const conflictRes = await dispatch({
    method: 'PUT',
    url: '/api/historia-clinica/borradores-temporales',
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      version_esperada: 1,
      datos_formulario: { motivo_consulta: 'Editado desde pestaña 1' },
    },
  });
  assert.equal(conflictRes.status, 409);
  assert.equal(conflictRes.json.code, 'BORRADOR_CONFLICT');
  assert.equal(conflictRes.json.data.borrador_actual.version, 2);
  drained();

  // 13d. Descarte explícito de borrador temporal
  queue(
    ...authSteps('PROFESIONAL'),
    scopeOkStep(),
    {
      table: 'rpc/descartar_borrador_formulario_clinico',
      method: 'POST',
      result: { descartado: true, cantidad: 1 },
    }
  );
  const delRes = await dispatch({
    method: 'DELETE',
    url: `/api/historia-clinica/borradores-temporales?id_paciente=${PATIENT_ID}&id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${profToken}` },
  });
  assert.equal(delRes.status, 200);
  assert.equal(delRes.json.data.descartado, true);
  drained();

  // 13e. Si las RPC propuestas aún no existen en Supabase (PGRST202), responde degradado sin error 500
  queue(
    ...authSteps('PROFESIONAL'),
    scopeOkStep(),
    {
      table: 'rpc/obtener_borrador_formulario_clinico',
      method: 'POST',
      status: 404,
      result: {
        code: 'PGRST202',
        message: 'Could not find the function public.obtener_borrador_formulario_clinico',
      },
    }
  );
  const fallbackRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/borradores-temporales?id_paciente=${PATIENT_ID}&id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${profToken}` },
  });
  assert.equal(fallbackRes.status, 200);
  assert.equal(fallbackRes.json.data.available, false);
  assert.equal(fallbackRes.json.data.borrador, null);
});

test('14. Fecha del acto clínico futura: bloquea firma definitiva (400) y permite preparar borrador con turno', async () => {
  const profToken = await makeToken('PROFESIONAL');
  const TURNO_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const futureDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

  // 14a. Intentar firmar consulta con fecha futura -> rechazado en validación (400)
  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', CLINICAL_ASSIST_PERMS),
    {
      ...scopeOkStep(),
      check: (_url, body) => {
        assert.equal(body?.p_fecha_acto, futureDate);
      },
    }
  );
  const signFutureRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      id_turno: TURNO_ID,
      fecha_atencion: `${futureDate}T08:30:00-03:00`,
      motivo_consulta: 'Preparación con intento inválido de firma futura',
      firmar: true,
    },
  });
  assert.equal(signFutureRes.status, 400);
  drained();

  // 14b. Guardar borrador anticipado vinculado a un turno futuro -> pre-flight hoy (p_fecha_acto: null) y envía fecha_preparacion
  queue(
    ...authSteps('PROFESIONAL'),
    {
      ...scopeOkStep(),
      check: (_url, body) => {
        assert.equal(body?.p_fecha_acto, null);
      },
    },
    {
      table: 'rpc/registrar_consulta_clinica',
      method: 'POST',
      result: {
        id_historia_clinica: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        id_consulta: CONSULTA_ID,
        estado: 'BORRADOR',
        via_acceso: 'SALITA_ASIGNADA',
        alcance: 'SALITA_ASIGNADA',
      },
      check: (_url, body) => {
        const datos = body?.p_datos as Record<string, unknown>;
        assert.equal(datos.firmar, false);
        assert.equal(datos.id_turno, TURNO_ID);
        assert.ok(typeof datos.fecha_preparacion === 'string');
      },
    }
  );
  const draftFutureRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      id_turno: TURNO_ID,
      fecha_atencion: `${futureDate}T08:30:00-03:00`,
      motivo_consulta: 'Preparación anticipada de turno programado',
      firmar: false,
    },
  });
  assert.equal(draftFutureRes.status, 201);
  assert.equal(draftFutureRes.json.data.estado, 'BORRADOR');
});

test('15. Turno del mismo día minutos antes (08:26 para turno 08:30): permite borrador con evoluciones y bloquea firma futura', async () => {
  const profToken = await makeToken('PROFESIONAL');
  const TURNO_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const sameDayPlus4MinIso = new Date(Date.now() + 4 * 60 * 1000).toISOString();

  // 15a. Intentar firmar minutos antes del horario futuro -> 400
  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', CLINICAL_ASSIST_PERMS),
    scopeOkStep()
  );
  const signEarlyRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      id_turno: TURNO_ID,
      fecha_atencion: sameDayPlus4MinIso,
      motivo_consulta: 'Intento de firma a las 08:26 para turno 08:30',
      firmar: true,
    },
  });
  assert.equal(signEarlyRes.status, 400);
  assert.ok(Array.isArray(signEarlyRes.json.errors));
  drained();

  // 15b. Guardar borrador anticipado del mismo día con id_turno y evoluciones (array) -> 201 BORRADOR
  queue(
    ...authSteps('PROFESIONAL'),
    scopeOkStep(),
    {
      table: 'rpc/registrar_consulta_clinica',
      method: 'POST',
      result: {
        id_historia_clinica: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        id_consulta: CONSULTA_ID,
        estado: 'BORRADOR',
        via_acceso: 'SALITA_ASIGNADA',
        alcance: 'SALITA_ASIGNADA',
      },
      check: (_url, body) => {
        const datos = body?.p_datos as Record<string, unknown>;
        assert.equal(datos.firmar, false);
        assert.equal(datos.id_turno, TURNO_ID);
        assert.ok(Array.isArray(datos.evoluciones));
      },
    }
  );
  const draftEarlyRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      id_turno: TURNO_ID,
      fecha_atencion: sameDayPlus4MinIso,
      fecha_preparacion: new Date().toISOString(),
      motivo_consulta: 'Preparación a las 08:26 para turno 08:30',
      sintomas: null,
      examen_fisico: null,
      observaciones: null,
      firmar: false,
      diagnosticos: [
        {
          codigo: null,
          descripcion: 'Control programado',
          tipo: 'PRESUNTIVO',
          fecha_diagnostico: '2026-11-11',
          observaciones: null,
        },
      ],
      evoluciones: [
        {
          evolucion: 'Nota preliminar de preparación',
          observaciones: null,
        },
      ],
    },
  });
  assert.equal(draftEarlyRes.status, 201);
  assert.equal(draftEarlyRes.json.data.estado, 'BORRADOR');
});

test('16. Continuación de borrador sin duplicación, bloqueo de degradación silenciosa, inmutabilidad y rectificación trazable', async () => {
  const profToken = await makeToken('PROFESIONAL');
  const TURNO_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

  // 16a. Si registrarConsultaClinica pide firmar=true pero la RPC devolviera BORRADOR, rechaza con 409 (no oculta degradación)
  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', CLINICAL_ASSIST_PERMS),
    scopeOkStep(),
    {
      table: 'rpc/registrar_consulta_clinica',
      method: 'POST',
      result: {
        id_consulta: CONSULTA_ID,
        estado: 'BORRADOR',
      },
    }
  );
  const downgradeGuardRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      motivo_consulta: 'Control clínico completo',
      firmar: true,
    },
  });
  assert.equal(downgradeGuardRes.status, 409);
  drained();

  // 16b. Actualizar borrador existente (PATCH /consultas/:id, firmar=false) mantiene BORRADOR y no toca turno
  queue(
    ...authSteps('PROFESIONAL'),
    scopeOkStep(),
    {
      table: 'rpc/actualizar_consulta_borrador',
      method: 'POST',
      result: {
        id_consulta: CONSULTA_ID,
        estado: 'BORRADOR',
        id_turno: TURNO_ID,
        turno_actualizado: false,
        turno_estado: null,
      },
      check: (_url, body) => {
        assert.equal(body?.p_id_consulta, CONSULTA_ID);
        assert.equal((body?.p_datos as Record<string, unknown>)?.firmar, false);
      },
    }
  );
  const patchDraftRes = await dispatch({
    method: 'PATCH',
    url: `/api/historia-clinica/consultas/${CONSULTA_ID}`,
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      id_turno: TURNO_ID,
      motivo_consulta: 'Motivo actualizado en el mismo borrador',
      firmar: false,
    },
  });
  assert.equal(patchDraftRes.status, 200);
  assert.equal(patchDraftRes.json.data.estado, 'BORRADOR');
  assert.equal(patchDraftRes.json.data.turno_actualizado, false);
  drained();

  // 16c. Firmar ese mismo borrador vía PATCH (firmar=true) -> FIRMADA y turno ATENDIDO sin duplicar consulta
  queue(
    ...authSteps('PROFESIONAL'),
    scopeOkStep(),
    {
      table: 'rpc/actualizar_consulta_borrador',
      method: 'POST',
      result: {
        id_consulta: CONSULTA_ID,
        estado: 'FIRMADA',
        id_profesional: PROFESIONAL_ID,
        id_turno: TURNO_ID,
        turno_actualizado: true,
        turno_estado: 'ATENDIDO',
      },
      check: (_url, body) => {
        assert.equal(body?.p_id_consulta, CONSULTA_ID);
        assert.equal((body?.p_datos as Record<string, unknown>)?.firmar, true);
      },
    }
  );
  const signExistingRes = await dispatch({
    method: 'PATCH',
    url: `/api/historia-clinica/consultas/${CONSULTA_ID}`,
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      id_turno: TURNO_ID,
      motivo_consulta: 'Motivo actualizado y firmado definitivamente',
      firmar: true,
    },
  });
  assert.equal(signExistingRes.status, 200);
  assert.equal(signExistingRes.json.data.estado, 'FIRMADA');
  assert.equal(signExistingRes.json.data.turno_actualizado, true);
  assert.equal(signExistingRes.json.data.turno_estado, 'ATENDIDO');
  drained();

  // 16d. Intentar modificar directamente la consulta ya FIRMADA -> rechazada (409) por inmutabilidad
  queue(
    ...authSteps('PROFESIONAL'),
    scopeOkStep(),
    {
      table: 'rpc/actualizar_consulta_borrador',
      method: 'POST',
      status: 400,
      result: {
        code: 'P0001',
        message: 'Una consulta médica en estado FIRMADA es inmutable y no admite modificaciones directas',
      },
    }
  );
  const editImmutableRes = await dispatch({
    method: 'PATCH',
    url: `/api/historia-clinica/consultas/${CONSULTA_ID}`,
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      motivo_consulta: 'Intento de edición directa posterior a la firma',
      firmar: false,
    },
  });
  assert.equal(editImmutableRes.status, 409);
  drained();

  // 16e. Rectificación trazable de evolución sobre consulta FIRMADA -> 201
  queue(
    ...authSteps('PROFESIONAL'),
    ...profesionalSalitaSteps(true),
    {
      table: 'rpc/rectificar_evolucion_clinica',
      method: 'POST',
      result: {
        id_evolucion_nueva: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        id_evolucion_origen: EVOLUCION_ID,
        version: 2,
      },
    }
  );
  const rectifyRes = await dispatch({
    method: 'POST',
    url: `/api/historia-clinica/evoluciones/${EVOLUCION_ID}/rectificar`,
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_salita: SALITA_ID,
      nueva_evolucion: 'Aclaración clínica trazable posterior a la firma.',
      motivo_correccion: 'Precisión de indicación posológica',
    },
  });
  assert.equal(rectifyRes.status, 200);
  assert.equal(rectifyRes.json.data.version, 2);
});

test('17. Sincronización atómica consulta firmada <-> turno ATENDIDO y consulta espontánea sin turno', async () => {
  const profToken = await makeToken('PROFESIONAL');
  const TURNO_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

  // 17a. Consulta vinculada a turno firmada al crear -> FIRMADA y turno ATENDIDO
  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', CLINICAL_ASSIST_PERMS),
    scopeOkStep(),
    {
      table: 'rpc/registrar_consulta_clinica',
      method: 'POST',
      result: {
        id_historia_clinica: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        id_consulta: CONSULTA_ID,
        estado: 'FIRMADA',
        id_profesional: PROFESIONAL_ID,
        id_turno: TURNO_ID,
        turno_actualizado: true,
        turno_estado: 'ATENDIDO',
      },
    }
  );
  const linkedSignRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      id_turno: TURNO_ID,
      motivo_consulta: 'Atención presencial de turno',
      firmar: true,
    },
  });
  assert.equal(linkedSignRes.status, 201);
  assert.equal(linkedSignRes.json.data.estado, 'FIRMADA');
  assert.equal(linkedSignRes.json.data.turno_actualizado, true);
  assert.equal(linkedSignRes.json.data.turno_estado, 'ATENDIDO');
  drained();

  // 17b. Consulta espontánea sin turno -> FIRMADA sin modificar agenda (turno_actualizado: false)
  queue(
    ...authSteps('PROFESIONAL'),
    scopeOkStep(),
    {
      table: 'rpc/registrar_consulta_clinica',
      method: 'POST',
      result: {
        id_historia_clinica: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        id_consulta: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        estado: 'FIRMADA',
        id_profesional: PROFESIONAL_ID,
        id_turno: null,
        turno_actualizado: false,
        turno_estado: null,
      },
    }
  );
  const spontaneousRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      motivo_consulta: 'Demanda espontánea sin turno',
      firmar: true,
    },
  });
  assert.equal(spontaneousRes.status, 201);
  assert.equal(spontaneousRes.json.data.estado, 'FIRMADA');
  assert.equal(spontaneousRes.json.data.turno_actualizado, false);
  drained();

  // 17c. Error al firmar borrador vinculado a turno CANCELADO -> 400 (no firma ni cambia turno)
  queue(
    ...authSteps('PROFESIONAL'),
    scopeOkStep(),
    {
      table: 'rpc/firmar_consulta_medica',
      method: 'POST',
      status: 400,
      result: {
        code: '22023',
        message: 'No se puede firmar una consulta vinculada a un turno en estado CANCELADO',
      },
    }
  );
  const cancelledTurnoSignRes = await dispatch({
    method: 'POST',
    url: `/api/historia-clinica/consultas/${CONSULTA_ID}/firmar`,
    headers: { Authorization: `Bearer ${profToken}` },
    body: {
      id_salita: SALITA_ID,
      id_paciente: PATIENT_ID,
    },
  });
  assert.equal(cancelledTurnoSignRes.status, 400);
});
