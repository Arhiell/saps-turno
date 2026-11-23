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
const OTRO_SALITA_ID = '55555555-5555-4555-8555-555555555599';
const PROFESIONAL_ID = '66666666-6666-4666-8666-666666666666';

interface DispatchResult {
  status: number;
  json: Record<string, any>;
}

const dispatch = (options: {
  method: string;
  url: string;
  headers?: Record<string, string>;
}): Promise<DispatchResult> =>
  new Promise((resolve, reject) => {
    const stream = new PassThrough();
    const req = new IncomingMessage(stream as unknown as Socket);
    req.method = options.method;
    req.url = options.url;
    req.headers = options.headers ?? {};
    req.push(null);

    const res = new ServerResponse(req);
    const chunks: Buffer[] = [];
    let settled = false;

    const finishResponse = () => {
      if (settled) return;
      settled = true;
      const text = Buffer.concat(chunks).toString('utf8');
      resolve({ status: res.statusCode, json: text ? JSON.parse(text) : {} });
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

const makeToken = (rol: string) =>
  generateAccessToken({
    id_usuario: USER_ID,
    email: 'user@saps.test',
    nombre_usuario: 'usuario.test',
    rol,
  });

const authSteps = (rol: string, idPersona: string | null = PERSON_ID) => [
  {
    table: 'usuarios',
    result: [
      {
        id_usuario: USER_ID,
        id_rol: ROLE_ID,
        id_persona: idPersona,
        nombre_usuario: 'usuario.test',
        email: 'user@saps.test',
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

beforeEach(() => {
  invalidatePermissionCache();
});

afterEach(() => {
  drained();
});

test('GET /api/auth/me incluye los permisos reales del rol desde PostgreSQL', async () => {
  queue(
    ...authSteps('SUPER_ADMIN', null),
    {
      table: 'usuarios',
      result: [{ id_persona: null, activo: true, email_verificado: true }],
    },
    rolePermissionsStep('SUPER_ADMIN', [CLINICAL_PERMISSIONS.VER_AUDITORIA_CLINICA])
  );

  const res = await dispatch({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${await makeToken('SUPER_ADMIN')}` },
  });

  assert.equal(res.status, 200);
  assert.deepEqual(res.json.data.user.permisos, [
    CLINICAL_PERMISSIONS.VER_AUDITORIA_CLINICA,
  ]);
});

test('SUPER_ADMIN con VER_AUDITORIA_CLINICA obtiene contexto mínimo y queda bloqueado en /pacientes', async () => {
  queue(
    ...authSteps('SUPER_ADMIN', PERSON_ID),
    rolePermissionsStep('SUPER_ADMIN', [CLINICAL_PERMISSIONS.VER_AUDITORIA_CLINICA]),
    {
      table: 'salitas',
      result: [{ id_salita: SALITA_ID, nombre: 'Salita Centro' }],
    }
  );

  const ctxRes = await dispatch({
    method: 'GET',
    url: '/api/historia-clinica/contexto',
    headers: { authorization: `Bearer ${await makeToken('SUPER_ADMIN')}` },
  });

  assert.equal(ctxRes.status, 200);
  assert.equal(ctxRes.json.data.id_profesional, null);
  assert.equal(ctxRes.json.data.catalogo_salitas.length, 1);

  invalidatePermissionCache();
  queue(
    ...authSteps('SUPER_ADMIN', PERSON_ID),
    rolePermissionsStep('SUPER_ADMIN', [CLINICAL_PERMISSIONS.VER_AUDITORIA_CLINICA])
  );

  const patRes = await dispatch({
    method: 'GET',
    url: '/api/historia-clinica/pacientes',
    headers: { authorization: `Bearer ${await makeToken('SUPER_ADMIN')}` },
  });

  assert.equal(patRes.status, 403);
});

test('PROFESIONAL con VER_HISTORIA_CLINICA busca pacientes dentro de salita vigente y bloquea salita ajena', async () => {
  queue(
    ...authSteps('PROFESIONAL', PERSON_ID),
    rolePermissionsStep('PROFESIONAL', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA]),
    {
      table: 'profesionales',
      result: [{ id_profesional: PROFESIONAL_ID, id_persona: PERSON_ID }],
    },
    {
      table: 'profesionales',
      result: [
        {
          id_profesional: PROFESIONAL_ID,
          id_persona: PERSON_ID,
          matricula: 'MP-100',
          activo: true,
          fecha_alta: '2025-01-01',
          fecha_baja: null,
          fecha_actualizacion: '2025-01-01',
          persona: {
            id_persona: PERSON_ID,
            dni: '30111222',
            nombres: 'Ana',
            apellidos: 'Medica',
            fecha_nacimiento: '1985-01-01',
            sexo: 'F',
            telefono: null,
            email: 'ana@saps.test',
            direccion: null,
            id_barrio: null,
            activo: true,
          },
        },
      ],
    },
    {
      table: 'profesional_salita',
      result: [
        {
          id_profesional: PROFESIONAL_ID,
          id_salita: SALITA_ID,
          fecha_desde: '2025-01-01',
          fecha_hasta: null,
          activo: true,
          salita: { id_salita: SALITA_ID, nombre: 'Salita Centro', activo: true },
        },
      ],
    },
    rolePermissionsStep('PROFESIONAL', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA]),
    {
      table: 'salitas',
      result: [{ id_salita: SALITA_ID, nombre: 'Salita Centro' }],
    },
    {
      table: 'pacientes',
      result: [
        {
          id_paciente: PATIENT_ID,
          id_persona: '77777777-7777-4777-8777-777777777771',
          id_barrio: null,
          id_salita_asignada: SALITA_ID,
          obra_social: 'OSDE',
          numero_afiliado: null,
          contacto_emergencia_nombre: null,
          contacto_emergencia_telefono: null,
          activo: true,
          fecha_registro: '2026-01-01T00:00:00Z',
          fecha_actualizacion: '2026-01-01T00:00:00Z',
          persona: {
            id_persona: '77777777-7777-4777-8777-777777777771',
            dni: '35123456',
            nombres: 'Juan',
            apellidos: 'Perez',
            fecha_nacimiento: '1992-03-10',
            sexo: 'M',
            telefono: null,
            email: null,
            direccion: null,
            id_barrio: null,
          },
        },
      ],
      count: 1,
    }
  );

  const okRes = await dispatch({
    method: 'GET',
    url: '/api/historia-clinica/pacientes?search=35123456',
    headers: { authorization: `Bearer ${await makeToken('PROFESIONAL')}` },
  });

  assert.equal(okRes.status, 200);
  assert.equal(okRes.json.data.patients.length, 1);
  assert.equal(okRes.json.data.patients[0].via_acceso_estimada, 'SALITA_ASIGNADA');

  invalidatePermissionCache();
  queue(
    ...authSteps('PROFESIONAL', PERSON_ID),
    rolePermissionsStep('PROFESIONAL', [CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA]),
    {
      table: 'profesionales',
      result: [{ id_profesional: PROFESIONAL_ID, id_persona: PERSON_ID }],
    },
    {
      table: 'profesionales',
      result: [
        {
          id_profesional: PROFESIONAL_ID,
          id_persona: PERSON_ID,
          matricula: 'MP-100',
          activo: true,
          fecha_alta: '2025-01-01',
          fecha_baja: null,
          fecha_actualizacion: '2025-01-01',
          persona: {
            id_persona: PERSON_ID,
            dni: '30111222',
            nombres: 'Ana',
            apellidos: 'Medica',
            fecha_nacimiento: '1985-01-01',
            sexo: 'F',
            telefono: null,
            email: 'ana@saps.test',
            direccion: null,
            id_barrio: null,
            activo: true,
          },
        },
      ],
    },
    {
      table: 'profesional_salita',
      result: [
        {
          id_profesional: PROFESIONAL_ID,
          id_salita: SALITA_ID,
          fecha_desde: '2025-01-01',
          fecha_hasta: null,
          activo: true,
          salita: { id_salita: SALITA_ID, nombre: 'Salita Centro', activo: true },
        },
      ],
    }
  );

  const forbiddenRes = await dispatch({
    method: 'GET',
    url: `/api/historia-clinica/pacientes?id_salita=${OTRO_SALITA_ID}`,
    headers: { authorization: `Bearer ${await makeToken('PROFESIONAL')}` },
  });

  assert.equal(forbiddenRes.status, 403);
});
