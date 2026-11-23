import assert from 'node:assert/strict';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import './patient-fixtures.js';

const { default: app } = await import('../src/app.js');
const { generateAccessToken } = await import('../src/services/jwt.service.js');
const { getDashboardSummary } = await import('../src/services/dashboard.service.js');

test('Dashboard: conteos exactos, día argentino, permisos y errores', async t => {
  const id = '11111111-1111-4111-8111-111111111111';
  let role = 'SUPER_ADMIN';
  let empty = false;
  let failCounts = false;
  let failActivity = false;
  const calls: URL[] = [];
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    calls.push(url);
    const table = url.pathname.split('/').at(-1);
    const head = options?.method === 'HEAD';
    if (head && failCounts || table === 'auditoria' && failActivity) {
      return new Response(head ? null : JSON.stringify({ message: 'fallo de base' }), { status: 500 });
    }
    if (head) {
      assert.ok(String(new Headers(options?.headers).get('prefer')).includes('count=exact'));
      assert.equal(url.searchParams.has('limit'), false);
      let count = 0;
      if (!empty) {
        if (table === 'turnos') {
          const state = url.searchParams.get('estado.codigo');
          const values: Record<string, number> = {
            'eq.SOLICITADO': 2, 'eq.CONFIRMADO': 3, 'eq.EN_ESPERA': 4,
            'eq.ATENDIDO': 5, 'eq.CANCELADO': 6, 'eq.NO_ASISTIO': 7, 'eq.REPROGRAMADO': 8,
          };
          count = state ? values[state]! : url.searchParams.has('fecha_solicitud') ? 50 : 35;
        } else {
          count = url.searchParams.get('activo') === 'eq.true' ? 1501 : 17;
          if (table === 'usuarios') {
            assert.ok(['eq.ADMIN_SALITA', 'eq.SUPER_ADMIN'].includes(url.searchParams.get('rol.codigo')!));
            assert.equal(url.searchParams.get('select')?.includes('usuario_salita'), false);
          }
        }
      }
      return new Response(null, { headers: { 'Content-Range': `*/${count}` } });
    }
    let data: unknown;
    if (table === 'usuarios') data = [{ id_usuario: id, id_persona: id, id_rol: id, activo: true, email_verificado: true }];
    else if (table === 'roles') data = [{ codigo: role, activo: true }];
    else {
      assert.equal(table, 'auditoria');
      assert.equal(url.searchParams.get('select'), 'id_auditoria,entidad,accion,fecha');
      assert.equal(url.searchParams.get('limit'), '8');
      assert.equal(url.searchParams.get('order'), 'fecha.desc,id_auditoria.desc');
      data = empty ? [] : [{ id_auditoria: 1, entidad: 'turnos', accion: 'INSERT', fecha: '2026-11-03T01:00:00Z' }];
    }
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  };

  // En UTC ya es 3/11, pero en Argentina todavía es 2/11.
  const summary = await getDashboardSummary(new Date('2026-11-03T02:30:00Z'));
  assert.equal(summary.fecha, '2026-11-02');
  assert.deepEqual(summary.pacientes, { activos: 1501, inactivos: 17, total: 1518 });
  assert.equal(summary.turnos.registrados_hoy, 50);
  assert.equal(summary.turnos.programados_hoy, 35);
  assert.equal(summary.turnos.pendientes, 9);
  assert.equal(summary.turnos.por_estado.CANCELADO, 6);
  assert.equal(summary.turnos.por_estado.NO_ASISTIO, 7);
  assert.equal(summary.actividad.data.length, 1);
  assert.deepEqual(summary.administradores, { activos: 1501, inactivos: 17, total: 1518 });
  assert.deepEqual(summary.superadministradores, { activos: 1501, inactivos: 17, total: 1518 });
  for (const url of calls.filter(url => url.pathname.endsWith('/turnos'))) {
    const field = url.searchParams.has('fecha_solicitud') ? 'fecha_solicitud' : 'fecha_hora_inicio';
    assert.deepEqual(url.searchParams.getAll(field), ['gte.2026-11-02T03:00:00.000Z', 'lt.2026-11-03T03:00:00.000Z']);
    assert.equal(url.searchParams.has('activo'), false);
    assert.equal(url.searchParams.has('estado.activo'), false);
  }

  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
  const token = await generateAccessToken({ id_usuario: id, email: 'test@example.com', nombre_usuario: 'test', rol: 'SUPER_ADMIN' });
  const call = (authenticated = true): Promise<{ status: number; body: any; cache: string | undefined }> => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: (server.address() as AddressInfo).port,
      path: '/api/reportes/dashboard', agent: false,
      headers: authenticated ? { Authorization: `Bearer ${token}` } : {} }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode!, body: JSON.parse(body), cache: res.headers['cache-control'] }));
    });
    req.on('error', reject);
    req.end();
  });
  assert.equal((await call(false)).status, 401);
  for (role of ['ADMIN_SALITA', 'PROFESIONAL', 'PACIENTE', 'RECEPCION']) {
    assert.equal((await call()).status, 403);
  }
  role = 'SUPER_ADMIN';
  empty = true;
  const response = await call();
  assert.equal(response.status, 200);
  assert.equal(response.cache, 'no-store');
  assert.equal(response.body.data.turnos.pendientes, 0);
  assert.deepEqual(response.body.data.salitas, { total: 0, activos: 0, inactivos: 0 });
  assert.deepEqual(response.body.data.actividad, { disponible: true, data: [] });
  failActivity = true;
  const partial = await call();
  assert.equal(partial.status, 200);
  assert.deepEqual(partial.body.data.actividad, { disponible: false, data: [] });
  failCounts = true;
  assert.equal((await call()).status, 500);
});
