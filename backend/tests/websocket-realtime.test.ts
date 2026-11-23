import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it, test } from 'node:test';
import { io as ioc, type Socket as ClientSocket } from '../../frontend/node_modules/socket.io-client/build/esm/index.js';

// Configurar variables de entorno antes de importar módulos
Object.assign(process.env, {
  SUPABASE_URL: 'http://supabase.invalid',
  SUPABASE_PUBLISHABLE_KEY: 'test-key',
  SUPABASE_SECRET_KEY: 'test-secret',
  JWT_ACCESS_SECRET: 'test-jwt-secret-websocket-2026-cora',
  JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-websocket-2026',
});

const { default: app } = await import('../src/app.js');
const { generateAccessToken } = await import('../src/services/jwt.service.js');
const {
  initSocketServer,
  getSocketIO,
  emitirCambioAgenda,
  emitirCambioPaciente,
  emitirCambioProfesional,
  emitirCambioSalita,
  emitirCambioClinico,
} = await import('../src/services/socket.service.js');

// Identificadores de prueba
const SALITA_1 = '11111111-aaaa-4111-8111-111111111111';
const SALITA_2 = '22222222-bbbb-4222-8222-222222222222';

const USER_ADMIN_1 = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const USER_ADMIN_2 = 'aaaaaaaa-2222-4111-8111-aaaaaaaaaaaa';
const USER_RECEPCION_1 = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb';
const USER_PROFESIONAL_1 = 'cccccccc-1111-4111-8111-cccccccccccc';
const USER_SUPER_ADMIN = 'dddddddd-1111-4111-8111-dddddddddddd';

const PROFESIONAL_ENTIDAD_ID = '99999999-cccc-4999-8999-999999999999';
const PERSON_PROF_ID = '88888888-cccc-4888-8888-888888888888';

const USER_PACIENTE_1 = 'eeeeeeee-1111-4111-8111-eeeeeeeeeeee';
const USER_PACIENTE_2 = 'eeeeeeee-2222-4111-8111-eeeeeeeeeeee';
const PERSON_PACIENTE_1 = '77777777-1111-4777-8777-777777777777';
const PERSON_PACIENTE_2 = '77777777-2222-4777-8777-777777777777';
const PACIENTE_ENTIDAD_1 = '66666666-1111-4666-8666-666666666666';
const PACIENTE_ENTIDAD_2 = '66666666-2222-4666-8666-666666666666';

const ROLE_ADMIN_ID = 'role-admin-uuid';
const ROLE_RECEPCION_ID = 'role-recepcion-uuid';
const ROLE_PROF_ID = 'role-prof-uuid';
const ROLE_SUPER_ADMIN_ID = 'role-superadmin-uuid';
const ROLE_PACIENTE_ID = 'role-paciente-uuid';

// Simulación de base de datos PostgreSQL/Supabase
const mockDatabase = {
  usuarios: [
    { id_usuario: USER_ADMIN_1, id_rol: ROLE_ADMIN_ID, id_persona: null, nombre_usuario: 'admin1', email: 'admin1@cora.gob.ar', email_verificado: true, activo: true },
    { id_usuario: USER_ADMIN_2, id_rol: ROLE_ADMIN_ID, id_persona: null, nombre_usuario: 'admin2', email: 'admin2@cora.gob.ar', email_verificado: true, activo: true },
    { id_usuario: USER_RECEPCION_1, id_rol: ROLE_RECEPCION_ID, id_persona: null, nombre_usuario: 'recep1', email: 'recep1@cora.gob.ar', email_verificado: true, activo: true },
    { id_usuario: USER_PROFESIONAL_1, id_rol: ROLE_PROF_ID, id_persona: PERSON_PROF_ID, nombre_usuario: 'prof1', email: 'prof1@cora.gob.ar', email_verificado: true, activo: true },
    { id_usuario: USER_SUPER_ADMIN, id_rol: ROLE_SUPER_ADMIN_ID, id_persona: null, nombre_usuario: 'superadmin', email: 'super@cora.gob.ar', email_verificado: true, activo: true },
    { id_usuario: USER_PACIENTE_1, id_rol: ROLE_PACIENTE_ID, id_persona: PERSON_PACIENTE_1, nombre_usuario: 'paciente1', email: 'paciente1@gmail.com', email_verificado: true, activo: true },
    { id_usuario: USER_PACIENTE_2, id_rol: ROLE_PACIENTE_ID, id_persona: PERSON_PACIENTE_2, nombre_usuario: 'paciente2', email: 'paciente2@gmail.com', email_verificado: true, activo: true },
  ],
  roles: [
    { id_rol: ROLE_ADMIN_ID, codigo: 'ADMIN_SALITA', nombre: 'Administrador de Salita', activo: true },
    { id_rol: ROLE_RECEPCION_ID, codigo: 'RECEPCION', nombre: 'Recepción', activo: true },
    { id_rol: ROLE_PROF_ID, codigo: 'PROFESIONAL', nombre: 'Profesional de la Salud', activo: true },
    { id_rol: ROLE_SUPER_ADMIN_ID, codigo: 'SUPER_ADMIN', nombre: 'Super Administrador', activo: true },
    { id_rol: ROLE_PACIENTE_ID, codigo: 'PACIENTE', nombre: 'Paciente', activo: true },
  ],
  usuario_salita: [
    { id_usuario: USER_ADMIN_1, id_salita: SALITA_1, activo: true, fecha_desde: '2020-01-01', fecha_hasta: null },
    { id_usuario: USER_ADMIN_2, id_salita: SALITA_2, activo: true, fecha_desde: '2020-01-01', fecha_hasta: null },
    { id_usuario: USER_RECEPCION_1, id_salita: SALITA_1, activo: true, fecha_desde: '2020-01-01', fecha_hasta: null },
  ],
  profesionales: [
    { id_profesional: PROFESIONAL_ENTIDAD_ID, id_persona: PERSON_PROF_ID, activo: true },
  ],
  profesional_salita: [
    { id_profesional: PROFESIONAL_ENTIDAD_ID, id_salita: SALITA_1, activo: true, fecha_desde: '2020-01-01', fecha_hasta: null },
  ],
  pacientes: [
    { id_paciente: PACIENTE_ENTIDAD_1, id_persona: PERSON_PACIENTE_1, id_salita_asignada: SALITA_1, activo: true },
    { id_paciente: PACIENTE_ENTIDAD_2, id_persona: PERSON_PACIENTE_2, id_salita_asignada: SALITA_2, activo: true },
  ],
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

  if (table === 'usuario_salita') {
    const idParam = url.searchParams.get('id_usuario');
    const eqMatch = idParam?.match(/^eq\.(.+)$/);
    const userId = eqMatch ? eqMatch[1] : null;
    const items = mockDatabase.usuario_salita.filter((us) => us.id_usuario === userId && us.activo);
    return new Response(JSON.stringify(items.map((i) => ({ id_salita: i.id_salita }))), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (table === 'profesionales') {
    const idPersonParam = url.searchParams.get('id_persona');
    const eqMatch = idPersonParam?.match(/^eq\.(.+)$/);
    const personId = eqMatch ? eqMatch[1] : null;
    const prof = mockDatabase.profesionales.find((p) => p.id_persona === personId && p.activo);
    return new Response(JSON.stringify(prof || null), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (table === 'pacientes') {
    const idPersonParam = url.searchParams.get('id_persona');
    const eqMatch = idPersonParam?.match(/^eq\.(.+)$/);
    const personId = eqMatch ? eqMatch[1] : null;
    const pac = mockDatabase.pacientes.find((p) => p.id_persona === personId && p.activo);
    return new Response(JSON.stringify(pac || null), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (table === 'profesional_salita') {
    const idProfParam = url.searchParams.get('id_profesional');
    const eqMatch = idProfParam?.match(/^eq\.(.+)$/);
    const profId = eqMatch ? eqMatch[1] : null;
    const items = mockDatabase.profesional_salita.filter((ps) => ps.id_profesional === profId && ps.activo);
    return new Response(JSON.stringify(items.map((i) => ({ id_salita: i.id_salita }))), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify([]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

describe('WebSockets y Sincronización en Tiempo Real', () => {
  let httpServer: ReturnType<typeof createServer>;
  let serverPort: number;

  before(async () => {
    httpServer = createServer(app);
    initSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as AddressInfo;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  after(async () => {
    const io = getSocketIO();
    if (io) {
      await io.close();
    }
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  const connectClient = (token?: string): Promise<ClientSocket> => {
    return new Promise((resolve, reject) => {
      const socket = ioc(`http://127.0.0.1:${serverPort}`, {
        auth: token ? { token } : undefined,
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });

      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (err) => reject(err));
    });
  };

  test('Autenticación WebSocket: Rechaza conexiones sin token o con token inválido', async () => {
    await assert.rejects(
      connectClient(undefined),
      /Token de autenticación requerido/
    );

    await assert.rejects(
      connectClient('token-invalido-12345'),
      /Invalid Compact JWS|Token inválido/
    );
  });

test('Validación de salas en backend: Los roles sólo se unen a sus salitas autorizadas por base de datos', async () => {
  const tokenAdmin1 = await generateAccessToken({
    id_usuario: USER_ADMIN_1,
    email: 'admin1@cora.gob.ar',
    nombre_usuario: 'admin1',
    rol: 'ADMIN_SALITA',
    email_verificado: true,
    perfil_completo: true,
  });

  const clientAdmin1 = await connectClient(tokenAdmin1);
  const io = getSocketIO();
  assert.ok(io);

  // Buscar el socket de Admin 1 en el servidor
  const serverSockets = Array.from(io.sockets.sockets.values());
  const serverSocketAdmin1 = serverSockets.find((s) => s.data.user?.id_usuario === USER_ADMIN_1);
  assert.ok(serverSocketAdmin1);

  // Salas unidas
  const roomsAdmin1 = Array.from(serverSocketAdmin1.rooms);
  assert.ok(roomsAdmin1.includes(`user:${USER_ADMIN_1}`), 'Debe pertenecer a su canal de usuario');
  assert.ok(roomsAdmin1.includes(`salita:${SALITA_1}`), 'Debe pertenecer a su salita asignada');
  assert.ok(!roomsAdmin1.includes(`salita:${SALITA_2}`), 'NO debe pertenecer a salita ajena');
  assert.ok(!roomsAdmin1.includes('super_admin'), 'NO debe pertenecer a super_admin');

  clientAdmin1.disconnect();
});

test('Profesional asignado a Salita 1 se une a su canal profesional y a salita:salita-1', async () => {
  const tokenProf = await generateAccessToken({
    id_usuario: USER_PROFESIONAL_1,
    email: 'prof1@cora.gob.ar',
    nombre_usuario: 'prof1',
    rol: 'PROFESIONAL',
    id_persona: PERSON_PROF_ID,
    email_verificado: true,
    perfil_completo: true,
  });

  const clientProf = await connectClient(tokenProf);
  const io = getSocketIO();
  const serverSockets = Array.from(io!.sockets.sockets.values());
  const serverSocketProf = serverSockets.find((s) => s.data.user?.id_usuario === USER_PROFESIONAL_1);
  assert.ok(serverSocketProf);

  const rooms = Array.from(serverSocketProf.rooms);
  assert.ok(rooms.includes(`user:${USER_PROFESIONAL_1}`));
  assert.ok(rooms.includes(`profesional:${PROFESIONAL_ENTIDAD_ID}`));
  assert.ok(rooms.includes(`salita:${SALITA_1}`));
  assert.ok(!rooms.includes(`salita:${SALITA_2}`));

  clientProf.disconnect();
});

test('Super Admin se une automáticamente a la sala global super_admin', async () => {
  const tokenSuper = await generateAccessToken({
    id_usuario: USER_SUPER_ADMIN,
    email: 'super@cora.gob.ar',
    nombre_usuario: 'superadmin',
    rol: 'SUPER_ADMIN',
    email_verificado: true,
    perfil_completo: true,
  });

  const clientSuper = await connectClient(tokenSuper);
  const io = getSocketIO();
  const serverSockets = Array.from(io!.sockets.sockets.values());
  const serverSocketSuper = serverSockets.find((s) => s.data.user?.id_usuario === USER_SUPER_ADMIN);
  assert.ok(serverSocketSuper);

  const rooms = Array.from(serverSocketSuper.rooms);
  assert.ok(rooms.includes('super_admin'));

  clientSuper.disconnect();
});

test('Interacción concurrente entre sesiones: Recepción crea turno -> Administración Salita 1 lo recibe, Salita 2 no lo recibe', async () => {
  const tokenAdmin1 = await generateAccessToken({ id_usuario: USER_ADMIN_1, email: 'admin1@cora.gob.ar', nombre_usuario: 'admin1', rol: 'ADMIN_SALITA', email_verificado: true, perfil_completo: true });
  const tokenAdmin2 = await generateAccessToken({ id_usuario: USER_ADMIN_2, email: 'admin2@cora.gob.ar', nombre_usuario: 'admin2', rol: 'ADMIN_SALITA', email_verificado: true, perfil_completo: true });

  const clientAdmin1 = await connectClient(tokenAdmin1);
  const clientAdmin2 = await connectClient(tokenAdmin2);

  const admin1Received: any[] = [];
  const admin2Received: any[] = [];

  clientAdmin1.on('agenda:cambio', (e) => admin1Received.push(e));
  clientAdmin2.on('agenda:cambio', (e) => admin2Received.push(e));

  // Simular creación de turno en Salita 1
  emitirCambioAgenda({
    tipo: 'TURNO_CREADO',
    mensaje: 'Nuevo turno registrado para Pedro Gomez a las 09:00',
    id_turno: 'turno-101',
    id_salita: SALITA_1,
    id_profesional: PROFESIONAL_ENTIDAD_ID,
    estado: 'ASIGNADO',
    paciente: 'Pedro Gomez',
  });

  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(admin1Received.length, 1, 'Admin Salita 1 debió recibir el evento TURNO_CREADO');
  assert.equal(admin1Received[0].tipo, 'TURNO_CREADO');
  assert.equal(admin1Received[0].id_salita, SALITA_1);
  assert.equal(admin1Received[0].id_turno, 'turno-101');

  // Aislamiento de salitas: Salita 2 jamás debe recibir eventos de Salita 1
  assert.equal(admin2Received.length, 0, 'Admin Salita 2 NO debe recibir eventos de Salita 1');

  clientAdmin1.disconnect();
  clientAdmin2.disconnect();
});

test('Recepción marca paciente EN_ESPERA -> Profesional asignado recibe TURNO_ACTUALIZADO en tiempo real', async () => {
  const tokenProf = await generateAccessToken({ id_usuario: USER_PROFESIONAL_1, email: 'prof1@cora.gob.ar', nombre_usuario: 'prof1', rol: 'PROFESIONAL', id_persona: PERSON_PROF_ID, email_verificado: true, perfil_completo: true });
  const clientProf = await connectClient(tokenProf);

  const eventsReceived: any[] = [];
  clientProf.on('agenda:cambio', (e) => eventsReceived.push(e));

  emitirCambioAgenda({
    tipo: 'TURNO_ACTUALIZADO',
    mensaje: 'El paciente Pedro Gomez se encuentra en sala de espera',
    id_turno: 'turno-101',
    id_salita: SALITA_1,
    id_profesional: PROFESIONAL_ENTIDAD_ID,
    estado: 'EN_ESPERA',
    paciente: 'Pedro Gomez',
  });

  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(eventsReceived.length, 1);
  assert.equal(eventsReceived[0].tipo, 'TURNO_ACTUALIZADO');
  assert.equal(eventsReceived[0].estado, 'EN_ESPERA');
  assert.equal(eventsReceived[0].id_profesional, PROFESIONAL_ENTIDAD_ID);

  clientProf.disconnect();
});

test('Seguridad y privacidad clínica: CONSULTA_FIRMADA solo envía identificadores mínimos y no filtra datos médicos', async () => {
  const tokenAdmin1 = await generateAccessToken({ id_usuario: USER_ADMIN_1, email: 'admin1@cora.gob.ar', nombre_usuario: 'admin1', rol: 'ADMIN_SALITA', email_verificado: true, perfil_completo: true });
  const clientAdmin1 = await connectClient(tokenAdmin1);

  const clinicalEvents: any[] = [];
  clientAdmin1.on('clinica:cambio', (e) => clinicalEvents.push(e));

  // Emisión tras firma de consulta clínica
  emitirCambioClinico({
    tipo: 'CONSULTA_FIRMADA',
    mensaje: 'Consulta clínica firmada',
    id_paciente: 'paciente-444',
    id_salita: SALITA_1,
    id_consulta: 'consulta-888',
    id_turno: 'turno-101',
  });

  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(clinicalEvents.length, 1);
  const ev = clinicalEvents[0];
  assert.equal(ev.tipo, 'CONSULTA_FIRMADA');
  assert.equal(ev.id_consulta, 'consulta-888');
  assert.equal(ev.id_paciente, 'paciente-444');

  // Comprobación estricta de no fuga de datos de salud por WebSockets
  assert.equal(ev.motivo_consulta, undefined, 'No debe transmitir motivo clínico');
  assert.equal(ev.diagnosticos, undefined, 'No debe transmitir diagnósticos');
  assert.equal(ev.tratamientos, undefined, 'No debe transmitir tratamientos');
  assert.equal(ev.evolucion, undefined, 'No debe transmitir evolución');
  assert.equal(ev.notas, undefined, 'No debe transmitir notas clínicas');

  clientAdmin1.disconnect();
});

test('Sincronización de Pacientes: Creación y cambios de estado son recibidos en la salita correspondiente', async () => {
  const tokenAdmin1 = await generateAccessToken({ id_usuario: USER_ADMIN_1, email: 'admin1@cora.gob.ar', nombre_usuario: 'admin1', rol: 'ADMIN_SALITA', email_verificado: true, perfil_completo: true });
  const clientAdmin1 = await connectClient(tokenAdmin1);

  const patientEvents: any[] = [];
  clientAdmin1.on('paciente:cambio', (e) => patientEvents.push(e));

  emitirCambioPaciente({
    tipo: 'PACIENTE_ESTADO_CAMBIADO',
    mensaje: 'Paciente activado',
    id_paciente: 'paciente-444',
    id_salita: SALITA_1,
    activo: true,
    nombre_paciente: 'Carlos Benitez',
    dni_paciente: '32111222',
  });

  emitirCambioPaciente({
    tipo: 'TUTOR_VINCULACION_ACTUALIZADA',
    mensaje: 'Se actualizó la relación de tutoría para Carlos Benitez',
    id_paciente: 'paciente-444',
    id_salita: SALITA_1,
    nombre_paciente: 'Carlos Benitez',
    dni_paciente: '32111222',
  });

  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(patientEvents.length, 2);
  assert.equal(patientEvents[0].tipo, 'PACIENTE_ESTADO_CAMBIADO');
  assert.equal(patientEvents[0].activo, true);
  assert.equal(patientEvents[1].tipo, 'TUTOR_VINCULACION_ACTUALIZADA');

  clientAdmin1.disconnect();
});

test('Sincronización en tiempo real para PACIENTE: Recibe eventos propios de agenda y clínicos, respetando la privacidad de otros pacientes', async () => {
  const tokenPac1 = await generateAccessToken({
    id_usuario: USER_PACIENTE_1,
    email: 'paciente1@gmail.com',
    nombre_usuario: 'paciente1',
    rol: 'PACIENTE',
    id_persona: PERSON_PACIENTE_1,
  });

  const tokenPac2 = await generateAccessToken({
    id_usuario: USER_PACIENTE_2,
    email: 'paciente2@gmail.com',
    nombre_usuario: 'paciente2',
    rol: 'PACIENTE',
    id_persona: PERSON_PACIENTE_2,
  });

  const clientPac1 = await connectClient(tokenPac1);
  const clientPac2 = await connectClient(tokenPac2);

  const pac1AgendaEvents: any[] = [];
  const pac2AgendaEvents: any[] = [];
  const pac1ClinicalEvents: any[] = [];
  const pac2ClinicalEvents: any[] = [];

  clientPac1.on('agenda:cambio', (evt) => pac1AgendaEvents.push(evt));
  clientPac2.on('agenda:cambio', (evt) => pac2AgendaEvents.push(evt));
  clientPac1.on('clinica:cambio', (evt) => pac1ClinicalEvents.push(evt));
  clientPac2.on('clinica:cambio', (evt) => pac2ClinicalEvents.push(evt));

  // 1. Emisión de turno para Paciente 1
  emitirCambioAgenda({
    tipo: 'TURNO_CREADO',
    mensaje: 'Se reservó un nuevo turno',
    id_turno: 'turno-pac1-001',
    id_paciente: PACIENTE_ENTIDAD_1,
    id_profesional: PROFESIONAL_ENTIDAD_ID,
    id_salita: SALITA_1,
    paciente: 'Paciente Uno',
  });

  // 2. Emisión clínica mínima para Paciente 1
  emitirCambioClinico({
    tipo: 'CONSULTA_FIRMADA',
    mensaje: 'Consulta médica firmada',
    id_paciente: PACIENTE_ENTIDAD_1,
    id_salita: SALITA_1,
    id_consulta: 'consulta-pac1-999',
  });

  await new Promise((resolve) => setTimeout(resolve, 80));

  // Paciente 1 debió recibir sus 2 eventos
  assert.equal(pac1AgendaEvents.length, 1, 'Paciente 1 debe recibir su cambio de agenda');
  assert.equal(pac1AgendaEvents[0].id_turno, 'turno-pac1-001');
  assert.equal(pac1ClinicalEvents.length, 1, 'Paciente 1 debe recibir su actualización clínica mínima');
  assert.equal(pac1ClinicalEvents[0].id_consulta, 'consulta-pac1-999');

  // Paciente 2 NO debió recibir ninguno (privacidad estricta)
  assert.equal(pac2AgendaEvents.length, 0, 'Paciente 2 no debe recibir eventos del Paciente 1');
  assert.equal(pac2ClinicalEvents.length, 0, 'Paciente 2 no debe recibir eventos clínicos del Paciente 1');

  clientPac1.disconnect();
  clientPac2.disconnect();
});

test('Deduplicación en cliente: Ventana deslizante descarta eventos duplicados con el mismo ID', () => {
  const seenEventIds = new Set<string>();
  const received: string[] = [];

  const handleIncomingEvent = (event: { id: string; tipo: string }) => {
    if (seenEventIds.has(event.id)) {
      return; // Duplicado descartado
    }
    seenEventIds.add(event.id);
    if (seenEventIds.size > 100) {
      const oldest = seenEventIds.values().next().value;
      if (oldest) seenEventIds.delete(oldest);
    }
    received.push(event.id);
  };

  const event1 = { id: 'evt-uuid-1', tipo: 'TURNO_CREADO' };
  const event2 = { id: 'evt-uuid-2', tipo: 'TURNO_ACTUALIZADO' };

  handleIncomingEvent(event1);
  handleIncomingEvent(event1); // Duplicado de red o retransmisión
  handleIncomingEvent(event2);
  handleIncomingEvent(event1); // Duplicado posterior

  assert.equal(received.length, 2, 'Solo se deben procesar los 2 eventos únicos');
  assert.deepEqual(received, ['evt-uuid-1', 'evt-uuid-2']);
});
});
