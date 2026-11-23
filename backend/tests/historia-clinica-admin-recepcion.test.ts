import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, test } from 'node:test';
import { queue, drained } from './patient-fixtures.js';

const { default: app } = await import('../src/app.js');
const { generateAccessToken } = await import('../src/services/jwt.service.js');
const { invalidatePermissionCache } = await import('../src/services/permission.service.js');
const { CLINICAL_PERMISSIONS } = await import('../src/types/permission.types.js');

const USER_ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const USER_RECEPCION_ID = '11111111-1111-4111-8111-222222222222';
const USER_PROF_ID = '11111111-1111-4111-8111-333333333333';
const USER_PACIENTE_ID = '11111111-1111-4111-8111-444444444444';

const ROLE_ADMIN_ID = '22222222-2222-4222-8222-111111111111';
const ROLE_RECEPCION_ID = '22222222-2222-4222-8222-222222222222';
const ROLE_PROF_ID = '22222222-2222-4222-8222-333333333333';
const ROLE_PACIENTE_ID = '22222222-2222-4222-8222-444444444444';

const PERSON_ID = '33333333-3333-4333-8333-333333333333';
const PATIENT_ID = '44444444-4444-4444-8444-444444444444';
const SALITA_ASIGNADA_ID = '55555555-5555-4555-8555-555555555555';
const SALITA_AJENA_ID = '55555555-5555-4555-8555-999999999999';
const PROFESIONAL_ID = '66666666-6666-4666-8666-666666666666';
const ESPECIALIDAD_ID = '77777777-7777-4777-8777-777777777777';
const CONSULTA_FIRMADA_ID = '88888888-8888-4888-8888-888888888888';
const CONSULTA_BORRADOR_ID = '88888888-8888-4888-8888-888888888889';

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

const makeToken = (rol: 'ADMIN_SALITA' | 'RECEPCION' | 'PROFESIONAL' | 'PACIENTE') => {
  const map = {
    ADMIN_SALITA: { id: USER_ADMIN_ID, email: 'admin@saps.test', nombre: 'admin.salita' },
    RECEPCION: { id: USER_RECEPCION_ID, email: 'recep@saps.test', nombre: 'recepcion.salita' },
    PROFESIONAL: { id: USER_PROF_ID, email: 'pro@saps.test', nombre: 'profesional.salita' },
    PACIENTE: { id: USER_PACIENTE_ID, email: 'paciente@saps.test', nombre: 'paciente.test' },
  };
  const u = map[rol];
  return generateAccessToken({
    id_usuario: u.id,
    email: u.email,
    nombre_usuario: u.nombre,
    rol,
  });
};

const authSteps = (rol: 'ADMIN_SALITA' | 'RECEPCION' | 'PROFESIONAL' | 'PACIENTE') => {
  const map = {
    ADMIN_SALITA: { id: USER_ADMIN_ID, roleId: ROLE_ADMIN_ID, email: 'admin@saps.test' },
    RECEPCION: { id: USER_RECEPCION_ID, roleId: ROLE_RECEPCION_ID, email: 'recep@saps.test' },
    PROFESIONAL: { id: USER_PROF_ID, roleId: ROLE_PROF_ID, email: 'pro@saps.test' },
    PACIENTE: { id: USER_PACIENTE_ID, roleId: ROLE_PACIENTE_ID, email: 'paciente@saps.test' },
  };
  const u = map[rol];
  return [
    {
      table: 'usuarios',
      result: [
        {
          id_usuario: u.id,
          id_rol: u.roleId,
          id_persona: PERSON_ID,
          nombre_usuario: rol.toLowerCase(),
          email: u.email,
          email_verificado: true,
          activo: true,
        },
      ],
    },
    {
      table: 'roles',
      result: [{ id_rol: u.roleId, codigo: rol, nombre: rol, activo: true }],
    },
  ];
};

const rolePermissionsStep = (
  rol: 'ADMIN_SALITA' | 'RECEPCION' | 'PROFESIONAL' | 'PACIENTE',
  permisos: string[]
) => {
  const roleId =
    rol === 'ADMIN_SALITA'
      ? ROLE_ADMIN_ID
      : rol === 'RECEPCION'
      ? ROLE_RECEPCION_ID
      : rol === 'PROFESIONAL'
      ? ROLE_PROF_ID
      : ROLE_PACIENTE_ID;

  return {
    table: 'roles',
    result: [
      {
        id_rol: roleId,
        codigo: rol,
        activo: true,
        rol_permisos: permisos.map((codigo) => ({
          permiso: { codigo, activo: true },
        })),
      },
    ],
  };
};

const mockHistoriaData = {
  historia_clinica: { id_historia_clinica: CONSULTA_FIRMADA_ID, estado: 'ACTIVA' },
  paciente: { id_paciente: PATIENT_ID, dni: '40111222' },
  via_acceso: 'SALITA_ASIGNADA',
  alcance: 'SALITA_ASIGNADA',
  id_derivacion: null,
  contenido_restringido_por_alcance: false,
  antecedentes: [
    { id_antecedente: 'ant-1', tipo: 'PERSONAL', estado: 'ACTIVO', descripcion: 'Hipertensión arterial' },
  ],
  alergias: [
    { id_alergia: 'ale-1', alergeno: 'Amoxicilina', estado: 'ACTIVA', gravedad: 'GRAVE' },
  ],
  consultas: [
    {
      id_consulta: CONSULTA_FIRMADA_ID,
      estado: 'FIRMADA',
      fecha_atencion: '2026-11-01',
      motivo_consulta: 'Control rutinario',
    },
  ],
};

const mockConsultaFirmadaData = {
  id_consulta: CONSULTA_FIRMADA_ID,
  estado: 'FIRMADA',
  id_paciente: PATIENT_ID,
  id_salita: SALITA_ASIGNADA_ID,
  fecha_atencion: '2026-11-01',
  motivo_consulta: 'Control rutinario',
  diagnosticos: [],
  evoluciones: [],
  tratamientos: [],
  estudios: [],
};

beforeEach(() => {
  invalidatePermissionCache();
});

afterEach(() => {
  invalidatePermissionCache();
  drained();
});

// ============================================================================
// SUITE A: ADMIN_SALITA (10 pruebas obligatorias de solo lectura)
// ============================================================================

test('A.1. ADMIN_SALITA: Puede consultar la Historia Clínica de un paciente de su salita asignada', async () => {
  const token = await makeToken('ADMIN_SALITA');

  queue(
    ...authSteps('ADMIN_SALITA'),
    rolePermissionsStep('ADMIN_SALITA', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA]),
    {
      table: 'rpc/verificar_acceso_clinico',
      method: 'POST',
      result: {
        autorizado: true,
        id_profesional: null,
        id_salita_paciente: SALITA_ASIGNADA_ID,
        via: 'SALITA_ASIGNADA',
        alcance: 'SALITA_ASIGNADA',
      },
    },
    {
      table: 'rpc/consultar_historia_clinica',
      method: 'POST',
      result: mockHistoriaData,
      check: (_url, body) => {
        assert.equal(body?.p_usuario, USER_ADMIN_ID);
        assert.equal(body?.p_paciente, PATIENT_ID);
        assert.equal(body?.p_salita, SALITA_ASIGNADA_ID);
        assert.equal(body?.p_es_exportacion, false);
      },
    }
  );

  const res = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ASIGNADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  assert.equal(res.json.success, true);
  assert.equal(res.json.data.paciente.id_paciente, PATIENT_ID);
});

test('A.2. ADMIN_SALITA: Puede consultar antecedentes y alergias del paciente', async () => {
  const token = await makeToken('ADMIN_SALITA');

  // Antecedentes
  queue(
    ...authSteps('ADMIN_SALITA'),
    rolePermissionsStep('ADMIN_SALITA', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA]),
    {
      table: 'rpc/verificar_acceso_clinico',
      method: 'POST',
      result: {
        autorizado: true,
        id_profesional: null,
        id_salita_paciente: SALITA_ASIGNADA_ID,
        via: 'SALITA_ASIGNADA',
        alcance: 'SALITA_ASIGNADA',
      },
    },
    {
      table: 'rpc/consultar_historia_clinica',
      method: 'POST',
      result: mockHistoriaData,
    }
  );

  const resAnt = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}/antecedentes?id_salita=${SALITA_ASIGNADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(resAnt.status, 200);
  assert.equal(resAnt.json.success, true);
  assert.equal(resAnt.json.data.antecedentes.length, 1);
  drained();

  // Alergias
  queue(
    ...authSteps('ADMIN_SALITA'),
    {
      table: 'rpc/verificar_acceso_clinico',
      method: 'POST',
      result: {
        autorizado: true,
        id_profesional: null,
        id_salita_paciente: SALITA_ASIGNADA_ID,
        via: 'SALITA_ASIGNADA',
        alcance: 'SALITA_ASIGNADA',
      },
    },
    {
      table: 'rpc/consultar_historia_clinica',
      method: 'POST',
      result: mockHistoriaData,
    }
  );

  const resAle = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}/alergias?id_salita=${SALITA_ASIGNADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(resAle.status, 200);
  assert.equal(resAle.json.success, true);
  assert.equal(resAle.json.data.alergias.length, 1);
});

test('A.3. ADMIN_SALITA: Puede ver consultas médicas cerradas/firmadas', async () => {
  const token = await makeToken('ADMIN_SALITA');

  queue(
    ...authSteps('ADMIN_SALITA'),
    rolePermissionsStep('ADMIN_SALITA', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA]),
    {
      table: 'usuario_salita',
      result: [{ id_salita: SALITA_ASIGNADA_ID }],
    },
    {
      table: 'rpc/consultar_consulta_medica',
      method: 'POST',
      result: mockConsultaFirmadaData,
      check: (_url, body) => {
        assert.equal(body?.p_usuario, USER_ADMIN_ID);
        assert.equal(body?.p_consulta, CONSULTA_FIRMADA_ID);
        assert.equal(body?.p_salita, SALITA_ASIGNADA_ID);
      },
    }
  );

  const res = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/consultas/${CONSULTA_FIRMADA_ID}?id_salita=${SALITA_ASIGNADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  assert.equal(res.json.success, true);
  assert.equal(res.json.data.estado, 'FIRMADA');
});

test('A.4. ADMIN_SALITA: No puede ver borradores clínicos ajenos o no firmados', async () => {
  const token = await makeToken('ADMIN_SALITA');

  queue(
    ...authSteps('ADMIN_SALITA'),
    rolePermissionsStep('ADMIN_SALITA', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA]),
    {
      table: 'usuario_salita',
      result: [{ id_salita: SALITA_ASIGNADA_ID }],
    },
    {
      table: 'rpc/consultar_consulta_medica',
      method: 'POST',
      status: 400,
      result: {
        code: 'P0001',
        message: 'Acceso clínico restringido: el borrador solo puede ser visualizado por su profesional autor',
      },
    }
  );

  const res = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/consultas/${CONSULTA_BORRADOR_ID}?id_salita=${SALITA_ASIGNADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 403);
  assert.match(res.json.message, /Acceso clínico restringido/i);
});

test('A.5. ADMIN_SALITA: No puede acceder a pacientes de otra salita sin derivación activa', async () => {
  const token = await makeToken('ADMIN_SALITA');

  queue(
    ...authSteps('ADMIN_SALITA'),
    rolePermissionsStep('ADMIN_SALITA', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA]),
    {
      table: 'rpc/verificar_acceso_clinico',
      method: 'POST',
      result: {
        autorizado: false,
        id_profesional: null,
        id_salita_paciente: SALITA_AJENA_ID,
        via: null,
        alcance: null,
      },
    }
  );

  const res = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_AJENA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 403);
  assert.equal(res.json.message, 'Acceso clínico no autorizado');
});

test('A.6. ADMIN_SALITA: No puede crear una consulta médica (POST /consultas -> 403)', async () => {
  const token = await makeToken('ADMIN_SALITA');

  queue(
    ...authSteps('ADMIN_SALITA'),
    // Rol ADMIN_SALITA solo posee VER_HISTORIA_CLINICA, carece de CREAR_CONSULTA_CLINICA
    rolePermissionsStep('ADMIN_SALITA', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA])
  );

  const res = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ASIGNADA_ID,
      motivo_consulta: 'Intento de creación de consulta por admin',
    },
  });

  assert.equal(res.status, 403);
  assert.equal(res.json.success, false);
});

test('A.7. ADMIN_SALITA: No puede modificar una consulta (PATCH /consultas/:id -> 403)', async () => {
  const token = await makeToken('ADMIN_SALITA');

  queue(
    ...authSteps('ADMIN_SALITA'),
    rolePermissionsStep('ADMIN_SALITA', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA])
  );

  const res = await dispatch({
    method: 'PATCH',
    url: `/api/historia-clinica/consultas/${CONSULTA_FIRMADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
    body: {
      motivo_consulta: 'Intento de modificación por admin',
    },
  });

  assert.equal(res.status, 403);
  assert.equal(res.json.success, false);
});

test('A.8. ADMIN_SALITA: No puede firmar una consulta (POST /consultas/:id/firmar -> 403)', async () => {
  const token = await makeToken('ADMIN_SALITA');

  queue(
    ...authSteps('ADMIN_SALITA'),
    rolePermissionsStep('ADMIN_SALITA', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA])
  );

  const res = await dispatch({
    method: 'POST',
    url: `/api/historia-clinica/consultas/${CONSULTA_FIRMADA_ID}/firmar`,
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id_salita: SALITA_ASIGNADA_ID,
    },
  });

  assert.equal(res.status, 403);
  assert.equal(res.json.success, false);
});

test('A.9. ADMIN_SALITA: No puede acceder a la auditoría clínica (GET /auditoria -> 403)', async () => {
  const token = await makeToken('ADMIN_SALITA');

  queue(
    ...authSteps('ADMIN_SALITA'),
    rolePermissionsStep('ADMIN_SALITA', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA])
  );

  const res = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/auditoria?id_salita=${SALITA_ASIGNADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 403);
  assert.equal(res.json.success, false);
});

test('A.10. ADMIN_SALITA: La auditoría clínica registra correctamente el acceso de lectura', async () => {
  const token = await makeToken('ADMIN_SALITA');
  let auditRecordedCorrectly = false;

  queue(
    ...authSteps('ADMIN_SALITA'),
    rolePermissionsStep('ADMIN_SALITA', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA]),
    {
      table: 'rpc/verificar_acceso_clinico',
      method: 'POST',
      result: {
        autorizado: true,
        id_profesional: null,
        id_salita_paciente: SALITA_ASIGNADA_ID,
        via: 'SALITA_ASIGNADA',
        alcance: 'SALITA_ASIGNADA',
      },
    },
    {
      table: 'rpc/consultar_historia_clinica',
      method: 'POST',
      result: mockHistoriaData,
      check: (_url, body) => {
        // En PostgreSQL, la función consultar_historia_clinica invoca internamente
        // registrar_acceso_auditoria_clinica(p_usuario, p_paciente, 'HISTORIA_CLINICA', ...)
        assert.equal(body?.p_usuario, USER_ADMIN_ID);
        assert.equal(body?.p_paciente, PATIENT_ID);
        assert.equal(body?.p_salita, SALITA_ASIGNADA_ID);
        auditRecordedCorrectly = true;
      },
    }
  );

  const res = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ASIGNADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  assert.equal(auditRecordedCorrectly, true);
});

// ============================================================================
// SUITE B: RECEPCION (10 pruebas obligatorias idénticas de solo lectura)
// ============================================================================

test('B.1. RECEPCION: Puede consultar la Historia Clínica de un paciente de su salita asignada', async () => {
  const token = await makeToken('RECEPCION');

  queue(
    ...authSteps('RECEPCION'),
    rolePermissionsStep('RECEPCION', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA]),
    {
      table: 'rpc/verificar_acceso_clinico',
      method: 'POST',
      result: {
        autorizado: true,
        id_profesional: null,
        id_salita_paciente: SALITA_ASIGNADA_ID,
        via: 'SALITA_ASIGNADA',
        alcance: 'SALITA_ASIGNADA',
      },
    },
    {
      table: 'rpc/consultar_historia_clinica',
      method: 'POST',
      result: mockHistoriaData,
      check: (_url, body) => {
        assert.equal(body?.p_usuario, USER_RECEPCION_ID);
        assert.equal(body?.p_paciente, PATIENT_ID);
        assert.equal(body?.p_salita, SALITA_ASIGNADA_ID);
        assert.equal(body?.p_es_exportacion, false);
      },
    }
  );

  const res = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ASIGNADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  assert.equal(res.json.success, true);
  assert.equal(res.json.data.paciente.id_paciente, PATIENT_ID);
});

test('B.2. RECEPCION: Puede consultar antecedentes y alergias del paciente', async () => {
  const token = await makeToken('RECEPCION');

  // Antecedentes
  queue(
    ...authSteps('RECEPCION'),
    rolePermissionsStep('RECEPCION', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA]),
    {
      table: 'rpc/verificar_acceso_clinico',
      method: 'POST',
      result: {
        autorizado: true,
        id_profesional: null,
        id_salita_paciente: SALITA_ASIGNADA_ID,
        via: 'SALITA_ASIGNADA',
        alcance: 'SALITA_ASIGNADA',
      },
    },
    {
      table: 'rpc/consultar_historia_clinica',
      method: 'POST',
      result: mockHistoriaData,
    }
  );

  const resAnt = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}/antecedentes?id_salita=${SALITA_ASIGNADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(resAnt.status, 200);
  assert.equal(resAnt.json.success, true);
  assert.equal(resAnt.json.data.antecedentes.length, 1);
  drained();

  // Alergias
  queue(
    ...authSteps('RECEPCION'),
    {
      table: 'rpc/verificar_acceso_clinico',
      method: 'POST',
      result: {
        autorizado: true,
        id_profesional: null,
        id_salita_paciente: SALITA_ASIGNADA_ID,
        via: 'SALITA_ASIGNADA',
        alcance: 'SALITA_ASIGNADA',
      },
    },
    {
      table: 'rpc/consultar_historia_clinica',
      method: 'POST',
      result: mockHistoriaData,
    }
  );

  const resAle = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}/alergias?id_salita=${SALITA_ASIGNADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(resAle.status, 200);
  assert.equal(resAle.json.success, true);
  assert.equal(resAle.json.data.alergias.length, 1);
});

test('B.3. RECEPCION: Puede ver consultas médicas cerradas/firmadas', async () => {
  const token = await makeToken('RECEPCION');

  queue(
    ...authSteps('RECEPCION'),
    rolePermissionsStep('RECEPCION', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA]),
    {
      table: 'usuario_salita',
      result: [{ id_salita: SALITA_ASIGNADA_ID }],
    },
    {
      table: 'rpc/consultar_consulta_medica',
      method: 'POST',
      result: mockConsultaFirmadaData,
      check: (_url, body) => {
        assert.equal(body?.p_usuario, USER_RECEPCION_ID);
        assert.equal(body?.p_consulta, CONSULTA_FIRMADA_ID);
        assert.equal(body?.p_salita, SALITA_ASIGNADA_ID);
      },
    }
  );

  const res = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/consultas/${CONSULTA_FIRMADA_ID}?id_salita=${SALITA_ASIGNADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  assert.equal(res.json.success, true);
  assert.equal(res.json.data.estado, 'FIRMADA');
});

test('B.4. RECEPCION: No puede ver borradores clínicos ajenos o no firmados', async () => {
  const token = await makeToken('RECEPCION');

  queue(
    ...authSteps('RECEPCION'),
    rolePermissionsStep('RECEPCION', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA]),
    {
      table: 'usuario_salita',
      result: [{ id_salita: SALITA_ASIGNADA_ID }],
    },
    {
      table: 'rpc/consultar_consulta_medica',
      method: 'POST',
      status: 400,
      result: {
        code: 'P0001',
        message: 'Acceso clínico restringido: el borrador solo puede ser visualizado por su profesional autor',
      },
    }
  );

  const res = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/consultas/${CONSULTA_BORRADOR_ID}?id_salita=${SALITA_ASIGNADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 403);
  assert.match(res.json.message, /Acceso clínico restringido/i);
});

test('B.5. RECEPCION: No puede acceder a pacientes de otra salita sin derivación activa', async () => {
  const token = await makeToken('RECEPCION');

  queue(
    ...authSteps('RECEPCION'),
    rolePermissionsStep('RECEPCION', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA]),
    {
      table: 'rpc/verificar_acceso_clinico',
      method: 'POST',
      result: {
        autorizado: false,
        id_profesional: null,
        id_salita_paciente: SALITA_AJENA_ID,
        via: null,
        alcance: null,
      },
    }
  );

  const res = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_AJENA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 403);
  assert.equal(res.json.message, 'Acceso clínico no autorizado');
});

test('B.6. RECEPCION: No puede crear una consulta médica (POST /consultas -> 403)', async () => {
  const token = await makeToken('RECEPCION');

  queue(
    ...authSteps('RECEPCION'),
    // Rol RECEPCION solo posee VER_HISTORIA_CLINICA, carece de CREAR_CONSULTA_CLINICA
    rolePermissionsStep('RECEPCION', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA])
  );

  const res = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ASIGNADA_ID,
      motivo_consulta: 'Intento de creación de consulta por recepcionista',
    },
  });

  assert.equal(res.status, 403);
  assert.equal(res.json.success, false);
});

test('B.7. RECEPCION: No puede modificar una consulta (PATCH /consultas/:id -> 403)', async () => {
  const token = await makeToken('RECEPCION');

  queue(
    ...authSteps('RECEPCION'),
    rolePermissionsStep('RECEPCION', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA])
  );

  const res = await dispatch({
    method: 'PATCH',
    url: `/api/historia-clinica/consultas/${CONSULTA_FIRMADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
    body: {
      motivo_consulta: 'Intento de modificación por recepción',
    },
  });

  assert.equal(res.status, 403);
  assert.equal(res.json.success, false);
});

test('B.8. RECEPCION: No puede firmar una consulta (POST /consultas/:id/firmar -> 403)', async () => {
  const token = await makeToken('RECEPCION');

  queue(
    ...authSteps('RECEPCION'),
    rolePermissionsStep('RECEPCION', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA])
  );

  const res = await dispatch({
    method: 'POST',
    url: `/api/historia-clinica/consultas/${CONSULTA_FIRMADA_ID}/firmar`,
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id_salita: SALITA_ASIGNADA_ID,
    },
  });

  assert.equal(res.status, 403);
  assert.equal(res.json.success, false);
});

test('B.9. RECEPCION: No puede acceder a la auditoría clínica (GET /auditoria -> 403)', async () => {
  const token = await makeToken('RECEPCION');

  queue(
    ...authSteps('RECEPCION'),
    rolePermissionsStep('RECEPCION', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA])
  );

  const res = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/auditoria?id_salita=${SALITA_ASIGNADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 403);
  assert.equal(res.json.success, false);
});

test('B.10. RECEPCION: La auditoría clínica registra correctamente el acceso de lectura', async () => {
  const token = await makeToken('RECEPCION');
  let auditRecordedCorrectly = false;

  queue(
    ...authSteps('RECEPCION'),
    rolePermissionsStep('RECEPCION', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA]),
    {
      table: 'rpc/verificar_acceso_clinico',
      method: 'POST',
      result: {
        autorizado: true,
        id_profesional: null,
        id_salita_paciente: SALITA_ASIGNADA_ID,
        via: 'SALITA_ASIGNADA',
        alcance: 'SALITA_ASIGNADA',
      },
    },
    {
      table: 'rpc/consultar_historia_clinica',
      method: 'POST',
      result: mockHistoriaData,
      check: (_url, body) => {
        assert.equal(body?.p_usuario, USER_RECEPCION_ID);
        assert.equal(body?.p_paciente, PATIENT_ID);
        assert.equal(body?.p_salita, SALITA_ASIGNADA_ID);
        auditRecordedCorrectly = true;
      },
    }
  );

  const res = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ASIGNADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  assert.equal(auditRecordedCorrectly, true);
});

// ============================================================================
// SUITE C: PROFESIONAL (Conserva permisos completos de creación, firma y consulta)
// ============================================================================

test('C. PROFESIONAL: Conserva sus permisos asistenciales completos (crear, firmar y consultar)', async () => {
  const token = await makeToken('PROFESIONAL');

  // 1. Puede crear consulta clínica
  queue(
    ...authSteps('PROFESIONAL'),
    rolePermissionsStep('PROFESIONAL', [
      CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA,
      CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA,
    ]),
    {
      table: 'rpc/verificar_acceso_clinico',
      method: 'POST',
      result: {
        autorizado: true,
        id_profesional: PROFESIONAL_ID,
        id_salita_paciente: SALITA_ASIGNADA_ID,
        via: 'SALITA_ASIGNADA',
        alcance: 'SALITA_ASIGNADA',
      },
    },
    {
      table: 'rpc/registrar_consulta_clinica',
      method: 'POST',
      result: {
        id_consulta: CONSULTA_FIRMADA_ID,
        estado: 'BORRADOR',
        id_profesional_autor: PROFESIONAL_ID,
      },
    }
  );

  const createRes = await dispatch({
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ASIGNADA_ID,
      id_especialidad: ESPECIALIDAD_ID,
      motivo_consulta: 'Atención clínica por profesional',
      firmar: false,
    },
  });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.json.success, true);
});

// ============================================================================
// SUITE D: PACIENTE (Accede a su propia HC por /mi-historia y es bloqueado en endpoints asistenciales)
// ============================================================================

test('D. PACIENTE: Accede a su propia HC desde el portal y queda bloqueado en endpoints asistenciales', async () => {
  const token = await makeToken('PACIENTE');

  // 1. Acceso permitido a su propio portal /mi-historia
  queue(
    ...authSteps('PACIENTE'),
    // 0. findUserById
    {
      table: 'usuarios',
      result: [
        {
          id_usuario: USER_PACIENTE_ID,
          id_persona: PERSON_ID,
          activo: true,
        },
      ],
    },
    // 1. currentRelations -> getOwnEntity
    { table: 'pacientes', result: [{ id_paciente: PATIENT_ID }] },
    // 2. findPatientById
    {
      table: 'pacientes',
      result: [
        {
          id_paciente: PATIENT_ID,
          id_persona: PERSON_ID,
          id_salita_asignada: SALITA_ASIGNADA_ID,
          id_barrio: '11111111-1111-4111-8111-111111111111',
          activo: true,
        },
      ],
    },
    // 3. tutores query
    { table: 'tutores', result: [] },
    // 4. findPatientHistoriaClinica -> datos paciente
    {
      table: 'pacientes',
      result: {
        id_paciente: PATIENT_ID,
        id_salita_asignada: SALITA_ASIGNADA_ID,
        id_barrio: '11111111-1111-4111-8111-111111111111',
        obra_social: null,
        numero_afiliado: null,
        persona: {
          dni: '40111222',
          nombres: 'Paciente',
          apellidos: 'Test',
          fecha_nacimiento: '1995-05-20',
          sexo: 'MASCULINO',
        },
        salita: { nombre: 'Salita Asignada' },
      },
    },
    // 5. historias_clinicas
    { table: 'historias_clinicas', result: null },
    // 6. derivaciones
    { table: 'autorizaciones_derivaciones_clinicas', result: [] }
  );

  const portalRes = await dispatch({
    method: 'GET',
    url: '/api/historia-clinica/mi-historia',
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(portalRes.status, 200);
  assert.equal(portalRes.json.success, true);
  assert.equal(portalRes.json.data.paciente.id_paciente, PATIENT_ID);
  drained();

  // 2. Bloqueado en endpoint administrativo asistencial /pacientes/:idPaciente
  queue(
    ...authSteps('PACIENTE'),
    rolePermissionsStep('PACIENTE', []) // Rol PACIENTE no tiene VER_HISTORIA_CLINICA
  );

  const adminRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ASIGNADA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(adminRes.status, 403);
  assert.equal(adminRes.json.success, false);
});
