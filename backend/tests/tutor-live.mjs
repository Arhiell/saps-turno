// Ejecutar con npm.cmd run dev iniciado: node tests/tutor-live.mjs --development
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db, query, request, login, finish, report } from './tutor-live-support.mjs';

try {
  const admin = await login('SUPER_ADMIN');
  const patientToken = await login('PACIENTE');
  const input = { dni: '30111222', nombres: 'Maria Laura', apellidos: 'Prueba API Tutor',
    fecha_nacimiento: '1985-08-10', sexo: 'FEMENINO', telefono: '3777123456',
    email: 'tutor.prueba@example.com', direccion: 'Belgrano 200', localidad: 'Goya',
    provincia: 'Corrientes', codigo_postal: '3450' };
  const previous = await query(db.from('personas').select('id_persona,nombres,apellidos')
    .eq('dni', input.dni).maybeSingle());
  if (previous) {
    assert.equal(previous.nombres, input.nombres); assert.equal(previous.apellidos, input.apellidos);
  }
  const existing = previous && await query(db.from('tutores').select('id_tutor,activo')
    .eq('id_persona', previous.id_persona).maybeSingle());
  if (existing) assert.equal(existing.activo, true);
  await request('Sin JWT', 'POST', '/api/tutors', 401, input);
  await request('PACIENTE no lista tutores', 'GET', '/api/tutors', 403, undefined, patientToken);
  await request('Telefono requerido', 'POST', '/api/tutors', 400, { ...input, telefono: null }, admin);
  const created = await request('Crear tutor', 'POST', '/api/tutors', existing ? 409 : 201, input, admin);
  const tutor = existing ?? created.data.tutor;
  const person = await query(db.from('personas').select('id_persona,activo').eq('dni', input.dni).single());
  const path = `/api/tutors/${tutor.id_tutor}`;
  report.records.push({ table: 'personas', id: person.id_persona, created: !previous, dni: input.dni },
    { table: 'tutores', id: tutor.id_tutor, created: !existing });
  await request('Tutor duplicado', 'POST', '/api/tutors', 409, input, admin);
  assert.equal((await query(db.from('personas').select('id_persona').eq('dni', input.dni))).length, 1);
  assert.equal((await query(db.from('tutores').select('id_tutor').eq('id_persona', person.id_persona))).length, 1);
  const list = await request('Listado paginado', 'GET', '/api/tutors?limit=1&page=1', 200, undefined, admin);
  assert.equal(list.data.pagination.limit, 1); assert.equal(list.data.tutors.length, 1);
  for (const route of [path, `/api/tutors/dni/${input.dni}`]) {
    const read = await request('Lectura plana', 'GET', route, 200, undefined, admin);
    assert.equal(read.data.tutor.id_persona, person.id_persona);
    assert.equal(read.data.tutor.dni, input.dni); assert.ok(!('persona' in read.data.tutor));
  }
  await request('UUID invalido', 'GET', '/api/tutors/no-uuid', 400, undefined, admin);
  await request('UUID inexistente', 'GET', `/api/tutors/${randomUUID()}`, 404, undefined, admin);
  await request('Paginacion invalida', 'GET', '/api/tutors?page=0', 400, undefined, admin);
  await request('PATCH tutor', 'PATCH', path, 200, { telefono: '3777555555', direccion: 'Nueva direccion 123' }, admin);
  const updated = await query(db.from('personas').select('telefono,direccion').eq('id_persona', person.id_persona).single());
  assert.equal(updated.telefono, '3777555555'); assert.equal(updated.direccion, 'Nueva direccion 123');
  await request('PATCH vacio', 'PATCH', path, 400, {}, admin);
  await request('Telefono nulo', 'PATCH', path, 400, { telefono: null }, admin);
  await request('DNI ocupado', 'PATCH', path, 409, { dni: '40999888' }, admin);
  await request('Desactivar tutor', 'PATCH', path + '/status', 200, { activo: false }, admin);
  await request('Repetir estado', 'PATCH', path + '/status', 409, { activo: false }, admin);
  const inactive = await request('Lectura inactivo', 'GET', path, 200, undefined, admin);
  assert.equal(inactive.data.tutor.activo, false);
  const activeList = await request('Listado excluye inactivo', 'GET', '/api/tutors', 200, undefined, admin);
  assert.ok(!activeList.data.tutors.some(t => t.id_tutor === tutor.id_tutor));
  assert.equal((await query(db.from('personas').select('activo').eq('id_persona', person.id_persona).single())).activo, true);
  await request('Reactivar tutor', 'PATCH', path + '/status', 200, { activo: true }, admin);
  // Reutilizar la persona de un paciente demuestra que ambos perfiles son independientes.
  const shared = await query(db.from('personas').select('*').eq('dni', '40999889').single());
  assert.equal(shared.apellidos, 'Prueba API');
  const sharedTutor = await query(db.from('tutores').select('id_tutor').eq('id_persona', shared.id_persona).maybeSingle());
  const reuse = await request('Reutilizar persona paciente', 'POST', '/api/tutors', sharedTutor ? 409 : 201,
    { dni: shared.dni, nombres: 'No sobrescribir', apellidos: shared.apellidos, telefono: '3777000000' }, admin);
  const second = sharedTutor ?? reuse.data.tutor;
  if (!sharedTutor) { assert.equal(second.id_persona, shared.id_persona); assert.equal(second.nombres, shared.nombres); }
  report.records.push({ table: 'tutores', id: second.id_tutor, id_persona: shared.id_persona, created: !sharedTutor });
  await request('Desactivar tutor que es paciente', 'PATCH', `/api/tutors/${second.id_tutor}/status`, 200, { activo: false }, admin);
  assert.equal((await query(db.from('pacientes').select('activo').eq('id_persona', shared.id_persona).single())).activo, true);
  assert.equal((await query(db.from('personas').select('activo').eq('id_persona', shared.id_persona).single())).activo, true);
  await request('Reactivar tutor compartido', 'PATCH', `/api/tutors/${second.id_tutor}/status`, 200, { activo: true }, admin);
  report.checks.push('DNI y perfil unicos; respuesta plana; cambios personales en personas',
    'Tutor inactivo excluido del listado; persona y paciente permanecen activos',
    'Persona de paciente reutilizada sin sobrescribir identidad');
} finally {
  await finish('tutor-live-results.json');
}
