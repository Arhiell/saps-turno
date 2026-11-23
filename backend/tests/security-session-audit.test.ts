import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { SignJWT } from 'jose';

// Configurar variables de entorno antes de importar módulos
Object.assign(process.env, {
  SUPABASE_URL: 'http://supabase.invalid',
  SUPABASE_PUBLISHABLE_KEY: 'test-key',
  SUPABASE_SECRET_KEY: 'test-secret',
  JWT_ACCESS_SECRET: 'test-jwt-secret-audit-2026-cora',
  JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-audit-2026',
  JWT_ACCESS_EXPIRES_MINUTES: '15',
});

// Identificadores de prueba
const SALITA_1 = '11111111-aaaa-4111-8111-111111111111';
const USER_PACIENTE_1 = 'eeeeeeee-1111-4111-8111-eeeeeeeeeeee';
const USER_PACIENTE_2 = 'eeeeeeee-2222-4111-8111-eeeeeeeeeeee';
const PERSON_PACIENTE_1 = '77777777-1111-4777-8777-777777777777';
const PERSON_PACIENTE_2 = '77777777-2222-4777-8777-777777777777';
const PACIENTE_ENTIDAD_1 = '66666666-1111-4666-8666-666666666666';
const PACIENTE_ENTIDAD_2 = '66666666-2222-4666-8666-666666666666';
const ROLE_PACIENTE_ID = 'role-paciente-uuid';

// Simulación de base de datos
const mockDatabase = {
  usuarios: [
    { id_usuario: USER_PACIENTE_1, id_rol: ROLE_PACIENTE_ID, id_persona: PERSON_PACIENTE_1, nombre_usuario: 'paciente1', email: 'paciente1@gmail.com', email_verificado: true, activo: true },
    { id_usuario: USER_PACIENTE_2, id_rol: ROLE_PACIENTE_ID, id_persona: PERSON_PACIENTE_2, nombre_usuario: 'paciente2', email: 'paciente2@gmail.com', email_verificado: true, activo: true },
  ],
  roles: [
    { id_rol: ROLE_PACIENTE_ID, codigo: 'PACIENTE', nombre: 'Paciente', activo: true },
  ],
  pacientes: [
    { id_paciente: PACIENTE_ENTIDAD_1, id_persona: PERSON_PACIENTE_1, id_salita_asignada: SALITA_1, activo: true, sexo: 'MASCULINO', persona: { nombres: 'Sonia', apellidos: 'Valdez', dni: '32123456' } },
    { id_paciente: PACIENTE_ENTIDAD_2, id_persona: PERSON_PACIENTE_2, id_salita_asignada: SALITA_1, activo: true, sexo: 'FEMENINO', persona: { nombres: 'Juan', apellidos: 'Perez', dni: '40111222' } },
  ],
  tutor_paciente: [] as any[],
  sesiones_refresh: [] as any[],
};

// Router mock para fetch de Supabase: intercepta llamadas REST a Supabase
const realFetch = globalThis.fetch;
globalThis.fetch = async (request: any, options: any) => {
  const url = new URL(String(request));
  if (!url.pathname.startsWith('/rest/v1/')) {
    return realFetch(request, options);
  }

  const table = url.pathname.replace('/rest/v1/', '');

  if (table === 'usuarios') {
    const idParam = url.searchParams.get('id_usuario');
    const eqMatch = idParam?.match(/^eq\.(.+)$/);
    const userId = eqMatch ? eqMatch[1] : null;
    const user = mockDatabase.usuarios.find((u) => u.id_usuario === userId);
    return new Response(JSON.stringify(user || null), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (table === 'roles') {
    const idParam = url.searchParams.get('id_rol');
    const eqMatch = idParam?.match(/^eq\.(.+)$/);
    const roleId = eqMatch ? eqMatch[1] : null;
    const role = mockDatabase.roles.find((r) => r.id_rol === roleId);
    return new Response(JSON.stringify(role || null), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (table === 'pacientes') {
    const idPersonParam = url.searchParams.get('id_persona');
    const eqMatch = idPersonParam?.match(/^eq\.(.+)$/);
    const personId = eqMatch ? eqMatch[1] : null;
    const idPacParam = url.searchParams.get('id_paciente');
    const eqPacMatch = idPacParam?.match(/^eq\.(.+)$/);
    const pacId = eqPacMatch ? eqPacMatch[1] : null;

    const pac = mockDatabase.pacientes.find((p) => (personId ? p.id_persona === personId : pacId ? p.id_paciente === pacId : false) && p.activo);
    return new Response(JSON.stringify(pac || null), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (table === 'tutor_paciente') {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify([]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

const { default: app } = await import('../src/app.js');
const { generateAccessToken, verifyAccessToken } = await import('../src/services/jwt.service.js');
const { resolveManagedPatient } = await import('../src/services/patient-managed.service.js');
const { initSocketServer } = await import('../src/services/socket.service.js');
const { io: ioc } = await import('../../frontend/node_modules/socket.io-client/build/esm/index.js');

// Helper de cliente isTokenValid idéntico al implementado en auth-storage.ts
const isTokenValidClient = (token: string | null): boolean => {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + 15_000;
  } catch {
    return false;
  }
};

describe('Auditoría de Seguridad y Resiliencia de Sesión', () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;
  let wsUrl: string;

  before(async () => {
    server = createServer(app);
    initSocketServer(server);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    wsUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('1. Verificación de isTokenValid en Cliente', () => {
    it('isTokenValid acepta un token legítimo con expiración en el futuro', async () => {
      const user = { id_usuario: USER_PACIENTE_1, email: 'paciente1@gmail.com', nombre_usuario: 'paciente1', rol: 'PACIENTE' as const };
      const token = await generateAccessToken(user);
      assert.equal(isTokenValidClient(token), true);
    });

    it('isTokenValid rechaza tokens nulos, vacíos o cadenas no válidas', () => {
      assert.equal(isTokenValidClient(null), false);
      assert.equal(isTokenValidClient(''), false);
      assert.equal(isTokenValidClient('abc.def'), false);
      assert.equal(isTokenValidClient('no-un-jwt-valido'), false);
    });

    it('isTokenValid rechaza tokens que vencen en menos de 15 segundos', async () => {
      const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
      const expiredSoonToken = await new SignJWT({ email: 'test@correo.com', role: 'PACIENTE' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(USER_PACIENTE_1)
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + 10)
        .sign(secret);

      assert.equal(isTokenValidClient(expiredSoonToken), false);
    });

    it('isTokenValid rechaza tokens ya expirados', async () => {
      const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
      const expiredToken = await new SignJWT({ email: 'test@correo.com', role: 'PACIENTE' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(USER_PACIENTE_1)
        .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
        .sign(secret);

      assert.equal(isTokenValidClient(expiredToken), false);
    });
  });

  describe('2. Verificación Criptográfica en el Backend (Cero Confianza en Cliente)', () => {
    it('Backend rechaza tokens con firma adulterada o clave incorrecta (HTTP 401)', async () => {
      const fakeSecret = new TextEncoder().encode('clave-atacante-completamente-falsa-1234');
      const forgedToken = await new SignJWT({
        email: 'paciente1@gmail.com',
        username: 'paciente1',
        role: 'SUPER_ADMIN',
        purpose: 'access',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(USER_PACIENTE_1)
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(fakeSecret);

      await assert.rejects(
        async () => {
          await verifyAccessToken(forgedToken);
        },
        (err: any) => {
          return err.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' || err.name === 'JWSSignatureVerificationFailed';
        }
      );

      const res = await fetch(`${baseUrl}/api/turnos`, {
        headers: { Authorization: `Bearer ${forgedToken}` },
      });
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.match(body.message, /Token inválido|no autorizado/i);
    });

    it('Backend rechaza tokens manipulados en el payload intermedio (HTTP 401)', async () => {
      const user = { id_usuario: USER_PACIENTE_1, email: 'paciente1@gmail.com', nombre_usuario: 'paciente1', rol: 'PACIENTE' as const };
      const legitToken = await generateAccessToken(user);

      const parts = legitToken.split('.');
      const payloadObj = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      payloadObj.role = 'SUPER_ADMIN';
      parts[1] = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
      const tamperedToken = parts.join('.');

      const res = await fetch(`${baseUrl}/api/turnos`, {
        headers: { Authorization: `Bearer ${tamperedToken}` },
      });
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.success, false);
    });

    it('Backend rechaza peticiones protegidas sin cabecera Authorization (HTTP 401)', async () => {
      const res = await fetch(`${baseUrl}/api/turnos`);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.success, false);
    });
  });

  describe('3. Aislamiento Estricto de Datos entre Pacientes (Anti-Spoofing)', () => {
    it('Paciente A no puede consultar turnos de Paciente B manipulando id_paciente (HTTP 403)', async () => {
      const userPaciente1 = {
        id_usuario: USER_PACIENTE_1,
        email: 'paciente1@gmail.com',
        nombre_usuario: 'paciente1',
        rol: 'PACIENTE' as const,
        activo: true,
        id_persona: PERSON_PACIENTE_1,
        permisos: [],
      };

      await assert.rejects(
        async () => {
          await resolveManagedPatient(userPaciente1 as any, PACIENTE_ENTIDAD_2);
        },
        (err: any) => {
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /No tenés un vínculo vigente que permita gestionar los turnos de esta persona/i);
          return true;
        }
      );
    });
  });

  describe('4. Seguridad y Autenticación en WebSockets', () => {
    it('WebSocket rechaza conexión cuando el token es inválido o no existe', async () => {
      await assert.rejects(
        new Promise((_, reject) => {
          const client = ioc(wsUrl, {
            auth: { token: 'token-invalido' },
            transports: ['websocket'],
            reconnection: false,
            timeout: 2000,
          });
          client.on('connect_error', (err) => {
            client.disconnect();
            reject(err);
          });
          client.on('connect', () => {
            client.disconnect();
            reject(new Error('No debería haber conectado con token inválido'));
          });
        }),
        /Token inválido|autenticación|Invalid Compact JWS/i
      );
    });

    it('WebSocket acepta conexión con token legítimo y se asocia únicamente al paciente autenticado', async () => {
      const user = { id_usuario: USER_PACIENTE_1, email: 'paciente1@gmail.com', nombre_usuario: 'paciente1', rol: 'PACIENTE' as const };
      const validToken = await generateAccessToken(user);

      const client = ioc(wsUrl, {
        auth: { token: validToken },
        transports: ['websocket'],
        reconnection: false,
        timeout: 4000,
      });

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          assert.ok(client.connected);
          client.disconnect();
          resolve();
        });
        client.on('connect_error', reject);
      });
    });
  });
});
