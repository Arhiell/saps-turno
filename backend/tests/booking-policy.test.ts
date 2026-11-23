import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { assertBookingDate, bookingWindow } from '../src/utils/booking-window.js';
import { assertAccountAccess } from '../src/services/account-access.service.js';
import { queue, drained, id, user, turno } from './turno-fixtures.js';

const { assertPatientCanBook } = await import('../src/services/booking-restriction.service.js');
const { getPatientAvailability } = await import('../src/services/patient-agenda.service.js');
const { createTurno } = await import('../src/services/turno.service.js');
const { changeTurnoStatus } = await import('../src/services/turno-update.service.js');
const { rethrowTurnoError } = await import('../src/utils/turno-error.js');
afterEach(drained);

test('La semana siguiente permanece cerrada hasta el sábado a las 12 de Argentina', () => {
  const before = new Date('2026-10-24T14:59:59.999Z');
  assert.deepEqual(bookingWindow(before), {
    desde: '2026-10-24', hasta: '2026-10-25',
    proxima_apertura: '2026-10-24T12:00:00-03:00', fechas: ['2026-10-24', '2026-10-25'],
  });
  assert.throws(() => assertBookingDate('2026-10-26', before), { code: 'BOOKING_WINDOW_CLOSED' });
  const noon = new Date('2026-10-24T15:00:00Z');
  assert.equal(bookingWindow(noon).hasta, '2026-11-01');
  assert.equal(bookingWindow(noon).proxima_apertura, '2026-10-31T12:00:00-03:00');
  assert.doesNotThrow(() => assertBookingDate('2026-11-01', noon));
  assert.throws(() => assertBookingDate('2026-11-02', noon), { statusCode: 409 });
});

test('Domingo conserva la próxima semana; el lunes no habilita otra semana adicional', () => {
  assert.equal(bookingWindow(new Date('2026-10-25T12:00:00-03:00')).hasta, '2026-11-01');
  assert.equal(bookingWindow(new Date('2026-10-26T00:00:00-03:00')).hasta, '2026-11-01');
  const monday = new Date('2026-10-26T00:00:00-03:00');
  assert.throws(() => assertBookingDate('2026-10-25', monday), { code: 'BOOKING_WINDOW_CLOSED' });
});

test('La ventana usa Argentina y cruza mes/año sin depender de la zona del servidor', () => {
  assert.equal(bookingWindow(new Date('2026-10-26T01:00:00Z')).desde, '2026-10-25');
  assert.equal(bookingWindow(new Date('2026-12-26T15:00:00Z')).hasta, '2027-01-03');
});

test('Bloqueo administrativo y temporal tienen códigos y vencimiento utilizables por todos los roles', () => {
  const now = new Date('2026-10-20T15:00:00Z');
  assert.throws(() => assertAccountAccess({ activo: false }, now), { code: 'ACCOUNT_DISABLED', statusCode: 403 });
  assert.throws(() => assertAccountAccess({ activo: true, bloqueado_hasta: '2026-10-20T15:01:00Z' }, now),
    { code: 'ACCOUNT_BLOCKED', data: { fecha_fin: '2026-10-20T15:01:00Z' } });
  assert.doesNotThrow(() => assertAccountAccess({ activo: true, bloqueado_hasta: now.toISOString() }, now));
  assert.doesNotThrow(() => assertAccountAccess({ activo: true, bloqueado_hasta: null }, now));
});

test('La sanción se consulta por paciente, en el instante actual, sin filtro de especialidad', async () => {
  const before = Date.now();
  queue({ table: 'sanciones', result: [{
    id_sancion: id, motivo: 'Inasistencia', fecha_inicio: '2026-01-01T00:00:00Z', fecha_fin: '2099-01-01T00:00:00Z',
  }], check: (url) => {
    assert.equal(url.searchParams.get('id_paciente'), `eq.${id}`);
    assert.equal(url.searchParams.get('id_especialidad'), null);
    assert.equal(url.searchParams.get('anulada'), 'eq.false');
    const start = url.searchParams.get('fecha_inicio')!.slice(4);
    const end = url.searchParams.get('fecha_fin')!.slice(3);
    assert.equal(start, end);
    assert.ok(Date.parse(start) >= before && Date.parse(start) <= Date.now());
    assert.equal(url.searchParams.get('order'), 'fecha_fin.desc');
  } });
  await assert.rejects(assertPatientCanBook(id), {
    code: 'PATIENT_SANCTIONED', statusCode: 409,
    data: { motivo: 'Inasistencia', fecha_inicio: '2026-01-01T00:00:00Z', fecha_fin: '2099-01-01T00:00:00Z' },
  });
  queue({ table: 'sanciones', result: [] });
  await assert.doesNotReject(assertPatientCanBook(id));
});

test('Fechas fuera de ventana se rechazan en disponibilidad y reserva antes de acceder a datos', async () => {
  const patient = { ...user, rol: 'PACIENTE' };
  await assert.rejects(getPatientAvailability(patient, {
    id_profesional: id, id_especialidad: id, id_salita: id, fecha: '2099-01-01',
  }), { code: 'BOOKING_WINDOW_CLOSED' });
  await assert.rejects(createTurno({
    id_profesional: id, id_especialidad: id, id_salita: id, id_paciente: id,
    fecha_hora_inicio: '2099-01-01T10:00:00-03:00',
  }, patient), { code: 'BOOKING_WINDOW_CLOSED' });
});

test('No se puede marcar inasistencia ni atención de un turno futuro', async () => {
  for (const estado of ['NO_ASISTIO', 'ATENDIDO'] as const) {
    queue({ table: 'turnos', result: [turno] });
    await assert.rejects(changeTurnoStatus(id, { estado }, user), { statusCode: 409 });
  }
});

test('Una sanción detectada por la base durante una reserva concurrente conserva su código público', () => {
  assert.throws(() => rethrowTurnoError({ code: 'P0001', message: 'PATIENT_SANCTIONED' }),
    { statusCode: 409, code: 'PATIENT_SANCTIONED' });
});
