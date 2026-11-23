import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { db, query, call, adminToken, results } from './turno-live-support.mjs';

// Smoke real sin escrituras: las solicitudes inválidas deben fallar antes del INSERT.
const token = await adminToken();
const [patient] = await query(db.from('pacientes').select('id_paciente').eq('activo', true).limit(1));
const [horario] = await query(db.from('horarios_atencion').select('id_profesional,id_especialidad,id_salita').eq('activo', true).limit(1));
const input = { ...horario, id_paciente: patient.id_paciente, fecha_hora_inicio: '2099-10-05T10:00:00-03:00' };
const missing = randomUUID();
try {
  for (const path of ['/api/health', '/api/health/database', '/api/users/health']) {
    await call(path, 'GET', path, 200);
  }
  await call('Sin JWT', 'POST', '/api/turnos', 401, input);
  await call('Listado', 'GET', '/api/turnos', 200, undefined, token);
  await call('Filtros combinados', 'GET', '/api/turnos?fecha=2099-10-05&estado=SOLICITADO&page=1&limit=10', 200, undefined, token);
  await call('UUID inválido', 'GET', '/api/turnos/no-uuid', 400, undefined, token);
  await call('Turno inexistente', 'GET', '/api/turnos/' + missing, 404, undefined, token);
  await call('Paciente inexistente', 'POST', '/api/turnos', 404, { ...input, id_paciente: missing }, token);
  await call('Profesional inexistente', 'POST', '/api/turnos', 404, { ...input, id_profesional: missing }, token);
  await call('Fecha pasada', 'POST', '/api/turnos', 400, { ...input, fecha_hora_inicio: '2020-01-01T10:00:00-03:00' }, token);
  await call('PATCH vacío', 'PATCH', '/api/turnos/' + missing, 400, {}, token);
  await call('Estado con formato inválido', 'PATCH', '/api/turnos/' + missing + '/status', 400, { estado: 'invalido' }, token);
} finally {
  await writeFile(new URL('turno-live-results.json', import.meta.url), JSON.stringify({ date: new Date().toISOString(),
    writes: false, requests: results }, null, 2) + '\n');
}
