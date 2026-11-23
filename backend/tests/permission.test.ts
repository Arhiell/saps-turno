import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, test } from 'node:test';
import express, { Router } from 'express';
import { queue, drained } from './patient-fixtures.js';

const { authenticate } = await import('../src/middlewares/auth.middleware.js');
const { requirePermission } = await import('../src/middlewares/permission.middleware.js');
const { clinicalScope, clinicalAuditScope } = await import(
  '../src/middlewares/clinical-scope.middleware.js'
);
const { errorHandler } = await import('../src/middlewares/error.middleware.js');
const { notFoundHandler } = await import('../src/middlewares/not-found.middleware.js');
const {
  invalidatePermissionCache,
  setPermissionCacheTtlMs,
  getPermissionCacheTtlMs,
} = await import('../src/services/permission.service.js');
const { CLINICAL_PERMISSIONS } = await import('../src/types/permission.types.js');
const { generateAccessToken } = await import('../src/services/jwt.service.js');
const { default: app } = await import('../src/app.js');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ROLE_ID = '22222222-2222-4222-8222-222222222222';
const PERSON_ID = '33333333-3333-4333-8333-333333333333';
const PATIENT_ID = '44444444-4444-4444-8444-444444444444';
const SALITA_ID = '55555555-5555-4555-8555-555555555555';
const PROFESIONAL_ID = '66666666-6666-4666-8666-666666666666';
const ESPECIALIDAD_ID = '77777777-7777-4777-8777-777777777777';

interface DispatchResult {
  status: number;
  json: Record<string, any>;
}

/**
 * Ejecuta la cadena completa de Express en memoria (sin abrir sockets TCP),
 * manteniendo el flujo real de middlewares, rutas y errorHandler.
 */
const dispatch = (
  targetApp: express.Express,
  options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  }
): Promise<DispatchResult> =>
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
      (targetApp as unknown as (r: IncomingMessage, s: ServerResponse) => void)(req, res);
    } catch (err) {
      stream.destroy();
      reject(err);
    }
  });

const buildClinicalTestApp = () => {
  const testApp = express();
  testApp.use(express.json());

  const hcRouter = Router();

  hcRouter.get(
    '/pacientes/:idPaciente',
    authenticate,
    requirePermission(CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA),
    clinicalScope({ permiso: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA }),
    (req, res) => {
      res.status(200).json({
        success: true,
        data: {
          usuario: req.user?.id_usuario,
          scope: res.locals.clinicalScope,
        },
      });
    }
  );

  hcRouter.post(
    '/consultas',
    authenticate,
    requirePermission(
      CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA,
      CLINICAL_PERMISSIONS.REGISTRAR_DIAGNOSTICOS
    ),
    clinicalScope({ permiso: CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA }),
    (_req, res) => {
      res.status(201).json({
        success: true,
        data: res.locals.clinicalScope,
      });
    }
  );

  hcRouter.get(
    '/auditoria',
    authenticate,
    requirePermission(CLINICAL_PERMISSIONS.VER_AUDITORIA_CLINICA),
    clinicalAuditScope(),
    (_req, res) => {
      res.status(200).json({
        success: true,
        data: res.locals.clinicalAuditScope,
      });
    }
  );

  hcRouter.get(
    '/inexistente',
    authenticate,
    requirePermission('PERMISO_INEXISTENTE'),
    (_req, res) => {
      res.status(200).json({ success: true });
    }
  );

  testApp.use('/api/historia-clinica', hcRouter);
  testApp.use(notFoundHandler);
  testApp.use(errorHandler);
  return testApp;
};

const clinicalApp = buildClinicalTestApp();

const makeToken = (rol = 'PROFESIONAL') =>
  generateAccessToken({
    id_usuario: USER_ID,
    email: 'pro@saps.test',
    nombre_usuario: 'profesional.test',
    rol,
  });

const authSteps = (opts: {
  rol?: string;
  roleActivo?: boolean;
  userActivo?: boolean;
  idPersona?: string | null;
  emailVerificado?: boolean;
} = {}) => {
  const rol = opts.rol ?? 'PROFESIONAL';
  return [
    {
      table: 'usuarios',
      result: [
        {
          id_usuario: USER_ID,
          id_rol: ROLE_ID,
          id_persona: opts.idPersona !== undefined ? opts.idPersona : PERSON_ID,
          nombre_usuario: 'profesional.test',
          email: 'pro@saps.test',
          email_verificado: opts.emailVerificado ?? true,
          activo: opts.userActivo ?? true,
        },
      ],
    },
    {
      table: 'roles',
      result: [
        {
          id_rol: ROLE_ID,
          codigo: rol,
          nombre: rol,
          activo: opts.roleActivo ?? true,
        },
      ],
    },
  ];
};

const rolePermissionsStep = (opts: {
  rol?: string;
  activo?: boolean;
  permisos?: Array<{ codigo: string; activo: boolean }>;
  status?: number;
  resultOverride?: unknown;
} = {}) => ({
  table: 'roles',
  status: opts.status ?? 200,
  result:
    opts.resultOverride !== undefined
      ? opts.resultOverride
      : [
          {
            id_rol: ROLE_ID,
            codigo: opts.rol ?? 'PROFESIONAL',
            activo: opts.activo ?? true,
            rol_permisos: (opts.permisos ?? []).map((p) => ({ permiso: p })),
          },
        ],
});

let originalTtl = 30_000;

beforeEach(() => {
  originalTtl = getPermissionCacheTtlMs();
  invalidatePermissionCache();
});

afterEach(() => {
  setPermissionCacheTtlMs(originalTtl);
  invalidatePermissionCache();
  drained();
});

test('1. Usuario sin JWT recibe 401 antes de consultar la base', async () => {
  const res = await dispatch(clinicalApp, {
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
  });

  assert.equal(res.status, 401);
  assert.equal(res.json.success, false);
});

test('2. Usuario con JWT inválido recibe 401', async () => {
  const res = await dispatch(clinicalApp, {
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
    headers: { Authorization: 'Bearer token.jwt.invalido' },
  });

  assert.equal(res.status, 401);
  assert.equal(res.json.success, false);
});

test('3. Usuario autenticado sin permiso requerido recibe 403', async () => {
  const token = await makeToken('PROFESIONAL');
  queue(
    ...authSteps({ rol: 'PROFESIONAL' }),
    rolePermissionsStep({
      rol: 'PROFESIONAL',
      permisos: [
        { codigo: CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA, activo: true },
      ],
    })
  );

  const res = await dispatch(clinicalApp, {
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 403);
  assert.equal(res.json.success, false);
});

test('4. Usuario con permiso correcto y alcance válido obtiene acceso permitido', async () => {
  const token = await makeToken('PROFESIONAL');
  queue(
    ...authSteps({ rol: 'PROFESIONAL' }),
    rolePermissionsStep({
      rol: 'PROFESIONAL',
      permisos: [{ codigo: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA, activo: true }],
    }),
    {
      table: 'rpc/verificar_acceso_clinico',
      method: 'POST',
      result: {
        autorizado: true,
        id_profesional: PROFESIONAL_ID,
        id_salita_paciente: SALITA_ID,
        via: 'SALITA_ASIGNADA',
        alcance: 'SALITA_ASIGNADA',
        id_derivacion: null,
        id_especialidad_autorizada: null,
        fecha_acceso: '2026-11-10',
        fecha_desde_autorizada: null,
        fecha_hasta_autorizada: null,
      },
      check: (_url, body) => {
        // Verifica que nunca se envíe id_profesional ni rol del request, sino req.user.id_usuario.
        assert.equal(body?.p_usuario, USER_ID);
        assert.equal(body?.p_paciente, PATIENT_ID);
        assert.equal(body?.p_salita, SALITA_ID);
        assert.equal(body?.p_permiso, CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA);
      },
    }
  );

  const res = await dispatch(clinicalApp, {
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  assert.equal(res.json.success, true);
  assert.equal(res.json.data.scope.id_profesional, PROFESIONAL_ID);
  assert.equal(res.json.data.scope.via, 'SALITA_ASIGNADA');
});

test('5. Usuario con rol inactivo es rechazado con 403 (tanto en authenticate como en requirePermission)', async () => {
  const token = await makeToken('PROFESIONAL');

  // Caso A: flujo completo con authenticate cuando roles.activo = false
  queue(...authSteps({ rol: 'PROFESIONAL', roleActivo: false }));
  const httpRes = await dispatch(clinicalApp, {
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(httpRes.status, 403);
  assert.equal(httpRes.json.success, false);
  drained();

  // Caso B: verificación directa del middleware requirePermission con rol inactivo en DB
  queue(rolePermissionsStep({ rol: 'PROFESIONAL', activo: false }));
  const directErr = await new Promise<any>((resolve) => {
    const mw = requirePermission(CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA);
    const req = {
      user: {
        id_usuario: USER_ID,
        id_rol: ROLE_ID,
        email: 'pro@saps.test',
        nombre_usuario: 'profesional.test',
        rol: 'PROFESIONAL',
      },
    } as express.Request;
    const res = { locals: {} } as express.Response;
    mw(req, res, (err?: unknown) => resolve(err));
  });
  assert.equal(directErr?.statusCode, 403);
});

test('6. Permiso inexistente o inactivo es rechazado con 403', async () => {
  const token = await makeToken('PROFESIONAL');

  // Permiso inexistente en la BD
  queue(
    ...authSteps({ rol: 'PROFESIONAL' }),
    rolePermissionsStep({
      rol: 'PROFESIONAL',
      permisos: [{ codigo: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA, activo: true }],
    })
  );
  const missingRes = await dispatch(clinicalApp, {
    method: 'GET',
    url: '/api/historia-clinica/inexistente',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(missingRes.status, 403);
  drained();

  invalidatePermissionCache();

  // Permiso existente en rol_permisos pero marcado activo = false
  queue(
    ...authSteps({ rol: 'PROFESIONAL' }),
    rolePermissionsStep({
      rol: 'PROFESIONAL',
      permisos: [{ codigo: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA, activo: false }],
    })
  );
  const inactivePermRes = await dispatch(clinicalApp, {
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(inactivePermRes.status, 403);
});

test('7. Error de Supabase en consulta de permisos responde 500 controlado sin exponer información sensible', async () => {
  const token = await makeToken('PROFESIONAL');
  queue(
    ...authSteps({ rol: 'PROFESIONAL' }),
    rolePermissionsStep({
      status: 500,
      resultOverride: {
        message: 'relation "public.rol_permisos" internal secret connection error',
        details: 'SUPABASE_SECRET_KEY leak test',
      },
    })
  );

  const res = await dispatch(clinicalApp, {
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 500);
  assert.equal(res.json.success, false);
  assert.equal(res.json.message, 'Error interno del servidor');
  assert.equal(JSON.stringify(res.json).includes('rol_permisos'), false);
  assert.equal(JSON.stringify(res.json).includes('SUPABASE'), false);
});

test('8. Profesional con permiso clínico solo accede si cumple el alcance clínico', async () => {
  const token = await makeToken('PROFESIONAL');
  queue(
    ...authSteps({ rol: 'PROFESIONAL' }),
    rolePermissionsStep({
      rol: 'PROFESIONAL',
      permisos: [{ codigo: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA, activo: true }],
    }),
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

  const res = await dispatch(clinicalApp, {
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}&id_especialidad=${ESPECIALIDAD_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 403);
  assert.equal(res.json.success, false);
});

test('9. Profesional sin VER_AUDITORIA_CLINICA no puede consultar auditoría clínica', async () => {
  const token = await makeToken('PROFESIONAL');
  queue(
    ...authSteps({ rol: 'PROFESIONAL' }),
    rolePermissionsStep({
      rol: 'PROFESIONAL',
      permisos: [
        { codigo: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA, activo: true },
        { codigo: CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA, activo: true },
        { codigo: CLINICAL_PERMISSIONS.GESTIONAR_ANTECEDENTES_CLINICOS, activo: true },
        { codigo: CLINICAL_PERMISSIONS.REGISTRAR_DIAGNOSTICOS, activo: true },
        { codigo: CLINICAL_PERMISSIONS.REGISTRAR_EVOLUCIONES, activo: true },
        { codigo: CLINICAL_PERMISSIONS.GESTIONAR_TRATAMIENTOS, activo: true },
        { codigo: CLINICAL_PERMISSIONS.GESTIONAR_ESTUDIOS_CLINICOS, activo: true },
        { codigo: CLINICAL_PERMISSIONS.GESTIONAR_DERIVACIONES_CLINICAS, activo: true },
      ],
    })
  );

  const res = await dispatch(clinicalApp, {
    method: 'GET',
    url: `/api/historia-clinica/auditoria?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 403);
  assert.equal(res.json.success, false);
});

test('10. ADMIN_SALITA y RECEPCION no pueden acceder al contenido clínico por el solo hecho de tener esos roles', async () => {
  for (const rol of ['ADMIN_SALITA', 'RECEPCION']) {
    invalidatePermissionCache();
    const token = await makeToken(rol);

    // 10a) Sin permiso clínico en BD: rechazado por requirePermission (403)
    queue(
      ...authSteps({ rol }),
      rolePermissionsStep({
        rol,
        permisos: [
          { codigo: 'GESTIONAR_PACIENTES', activo: true },
          { codigo: 'GESTIONAR_TURNOS', activo: true },
        ],
      })
    );

    const noPermRes = await dispatch(clinicalApp, {
      method: 'GET',
      url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(noPermRes.status, 403);
    drained();

    // 10b) Incluso si un error de configuración otorgara el permiso en rol_permisos,
    // el scope clínico bloquea el acceso asistencial para ADMIN_SALITA y RECEPCION (403).
    invalidatePermissionCache();
    queue(
      ...authSteps({ rol }),
      rolePermissionsStep({
        rol,
        permisos: [{ codigo: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA, activo: true }],
      })
    );

    const scopeBlockedRes = await dispatch(clinicalApp, {
      method: 'GET',
      url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(scopeBlockedRes.status, 403);
    drained();
  }
});

test('11. Múltiples permisos requeridos, caché con invalidación y protección contra manipulación del frontend', async () => {
  const token = await makeToken('SUPER_ADMIN'); // JWT declara SUPER_ADMIN, pero la BD manda.

  // Primera llamada: carga permisos reales de PROFESIONAL y cachea
  queue(
    ...authSteps({ rol: 'PROFESIONAL' }),
    rolePermissionsStep({
      rol: 'PROFESIONAL',
      permisos: [
        { codigo: CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA, activo: true },
        { codigo: CLINICAL_PERMISSIONS.REGISTRAR_DIAGNOSTICOS, activo: true },
      ],
    }),
    {
      table: 'rpc/verificar_acceso_clinico',
      method: 'POST',
      result: {
        autorizado: true,
        id_profesional: PROFESIONAL_ID,
        id_salita_paciente: SALITA_ID,
        via: 'SALITA_ASIGNADA',
        alcance: 'SALITA_ASIGNADA',
        id_derivacion: null,
        id_especialidad_autorizada: null,
        fecha_acceso: '2026-11-10',
        fecha_desde_autorizada: null,
        fecha_hasta_autorizada: null,
      },
      check: (_url, body) => {
        // Aunque el body envíe otro id_usuario / id_profesional / rol, se ignora.
        assert.equal(body?.p_usuario, USER_ID);
      },
    }
  );

  const first = await dispatch(clinicalApp, {
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
      id_usuario: '99999999-9999-4999-8999-999999999999',
      id_profesional: '99999999-9999-4999-8999-999999999999',
      rol: 'SUPER_ADMIN',
      permisos: ['VER_AUDITORIA_CLINICA'],
    },
  });
  assert.equal(first.status, 201);
  drained();

  // Segunda llamada sin invalidar caché: NO vuelve a consultar `roles` para permisos
  queue(...authSteps({ rol: 'PROFESIONAL' }), {
    table: 'rpc/verificar_acceso_clinico',
    method: 'POST',
    result: {
      autorizado: true,
      id_profesional: PROFESIONAL_ID,
      id_salita_paciente: SALITA_ID,
      via: 'SALITA_ASIGNADA',
      alcance: 'SALITA_ASIGNADA',
      id_derivacion: null,
      id_especialidad_autorizada: null,
      fecha_acceso: '2026-11-10',
      fecha_desde_autorizada: null,
      fecha_hasta_autorizada: null,
    },
  });

  const cachedRes = await dispatch(clinicalApp, {
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
    },
  });
  assert.equal(cachedRes.status, 201);
  drained();

  // Invalidación explícita de caché: la próxima llamada vuelve a consultar BD y detecta permiso revocado
  invalidatePermissionCache({ codigo: 'PROFESIONAL' });
  queue(
    ...authSteps({ rol: 'PROFESIONAL' }),
    rolePermissionsStep({
      rol: 'PROFESIONAL',
      permisos: [{ codigo: CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA, activo: true }],
    })
  );

  const afterRevoke = await dispatch(clinicalApp, {
    method: 'POST',
    url: '/api/historia-clinica/consultas',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      id_paciente: PATIENT_ID,
      id_salita: SALITA_ID,
    },
  });
  assert.equal(afterRevoke.status, 403);
});

test('12. Rutas reales de auditoria, access-management y users validan permisos desde base de datos', async () => {
  const token = await makeToken('ADMIN_SALITA');

  // GET /api/auditoria sin VER_AUDITORIA -> 403
  queue(
    ...authSteps({ rol: 'ADMIN_SALITA' }),
    rolePermissionsStep({
      rol: 'ADMIN_SALITA',
      permisos: [{ codigo: 'GESTIONAR_USUARIOS', activo: true }],
    })
  );
  const auditDenied = await dispatch(app, {
    method: 'GET',
    url: '/api/auditoria',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(auditDenied.status, 403);
  drained();

  // GET /api/access-management/accounts sin GESTIONAR_USUARIOS -> 403
  invalidatePermissionCache();
  queue(
    ...authSteps({ rol: 'ADMIN_SALITA' }),
    rolePermissionsStep({
      rol: 'ADMIN_SALITA',
      permisos: [{ codigo: 'VER_AUDITORIA', activo: true }],
    })
  );
  const accessDenied = await dispatch(app, {
    method: 'GET',
    url: '/api/access-management/accounts',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(accessDenied.status, 403);
  drained();

  // POST /api/users/admins con GESTIONAR_USUARIOS pero sin GESTIONAR_ROLES -> 403
  invalidatePermissionCache();
  const superToken = await makeToken('SUPER_ADMIN');
  queue(
    ...authSteps({ rol: 'SUPER_ADMIN' }),
    rolePermissionsStep({
      rol: 'SUPER_ADMIN',
      permisos: [{ codigo: 'GESTIONAR_USUARIOS', activo: true }],
    })
  );
  const adminCreateDenied = await dispatch(app, {
    method: 'POST',
    url: '/api/users/admins',
    headers: { Authorization: `Bearer ${superToken}` },
    body: {},
  });
  assert.equal(adminCreateDenied.status, 403);
});

test('13. SUPER_ADMIN sin perfil asistencial es bloqueado por clinicalScope y error RPC inesperado responde 500', async () => {
  const superToken = await makeToken('SUPER_ADMIN');
  queue(
    ...authSteps({ rol: 'SUPER_ADMIN' }),
    rolePermissionsStep({
      rol: 'SUPER_ADMIN',
      permisos: [{ codigo: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA, activo: true }],
    })
  );

  const superClinicalRes = await dispatch(clinicalApp, {
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${superToken}` },
  });
  assert.equal(superClinicalRes.status, 403);
  drained();

  // Error inesperado de Supabase RPC en clinicalScope -> 500 sin exponer detalles
  invalidatePermissionCache();
  const proToken = await makeToken('PROFESIONAL');
  queue(
    ...authSteps({ rol: 'PROFESIONAL' }),
    rolePermissionsStep({
      rol: 'PROFESIONAL',
      permisos: [{ codigo: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA, activo: true }],
    }),
    {
      table: 'rpc/verificar_acceso_clinico',
      method: 'POST',
      status: 500,
      result: { message: 'internal postgres failure on clinical rpc' },
    }
  );

  const rpcErrRes = await dispatch(clinicalApp, {
    method: 'GET',
    url: `/api/historia-clinica/pacientes/${PATIENT_ID}?id_salita=${SALITA_ID}`,
    headers: { Authorization: `Bearer ${proToken}` },
  });
  assert.equal(rpcErrRes.status, 500);
  assert.equal(rpcErrRes.json.message, 'Error interno del servidor');
  assert.equal(JSON.stringify(rpcErrRes.json).includes('postgres'), false);
});
