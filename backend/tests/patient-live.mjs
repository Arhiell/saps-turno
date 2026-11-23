// Prueba opt-in contra desarrollo. Conserva fixtures identificables y desactiva cuentas.
// Ejecutar con la API iniciada: node tests/patient-live.mjs --development
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { env } from '../dist/config/env.js';
import { supabase as db } from '../dist/config/supabase.js';
import { hashPassword } from '../dist/services/password.service.js';

assert.ok(process.argv.includes('--development') && env.NODE_ENV === 'development',
  'Requiere --development y NODE_ENV=development');
const base = `http://127.0.0.1:${env.PORT}`;
const report = { date: new Date().toISOString(), requests: [], records: [], checks: [] };
const accounts = [];
let patientId;
let adminToken;
async function query(builder) {
  const { data, error } = await builder;
  if (error) throw new Error(`Supabase: ${error.code}: ${error.message}`);
  return data;
}
async function request(label, method, path, expected, body, token) {
  const response = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000)
  });
  const json = await response.json();
  report.requests.push({ label, method, path, expected, status: response.status });
  console.log(`${label}: ${response.status}`);
  assert.equal(response.status, expected, label);
  return json;
}
async function fixture(table, key, value, values, idColumn) {
  let row = await query(db.from(table).select('*').eq(key, value).maybeSingle());
  const created = !row;
  if (!row) row = await query(db.from(table).insert(values).select('*').single());
  report.records.push({ table, id: row[idColumn], created });
  return row;
}
async function loginFixture(role) {
  const name = `test_api_${role.toLowerCase()}`;
  const existing = await query(db.from('usuarios').select('id_usuario,id_rol,activo,email')
    .eq('nombre_usuario', name).maybeSingle());
  const r = await query(db.from('roles').select('id_rol').eq('codigo', role).single());
  if (existing) {
    assert.equal(existing.activo, false, 'No modificar cuentas de prueba en uso');
    assert.equal(existing.id_rol, r.id_rol);
    assert.equal(existing.email, `${name}@example.com`);
  }
  const password = randomBytes(32).toString('base64url');
  const values = { nombre_usuario: name, email: `${name}@example.com`, id_rol: r.id_rol,
    password_hash: await hashPassword(password), email_verificado: true, activo: true };
  const user = await query((existing
    ? db.from('usuarios').update(values).eq('id_usuario', existing.id_usuario)
    : db.from('usuarios').insert(values)).select('id_usuario').single());
  accounts.push(user.id_usuario);
  report.records.push({ table: 'usuarios', id: user.id_usuario, role, created: !existing });
  const result = await request(`Login ${role}`, 'POST', '/api/auth/login', 200,
    { identifier: name, password });
  assert.equal(typeof result.data.accessToken, 'string');
  return result.data.accessToken;
}
try {
  await request('Health', 'GET', '/api/health', 200);
  const health = await request('Health DB', 'GET', '/api/health/database', 200);
  assert.equal(health.data.rolesFound, 5);
  const users = await request('Health usuarios', 'GET', '/api/users/health', 200);
  assert.equal(users.data.rolesCount, 5);
  assert.equal(users.data.usersTable, true);
  for (const table of ['personas','pacientes','tutores','profesionales','usuarios',
    'zonas','barrios','salitas','salita_barrios']) {
    await query(db.from(table).select('*').limit(0));
  }
  const schemaResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/`, { headers: {
    apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` } });
  assert.equal(schemaResponse.status, 200);
  const schema = await schemaResponse.json();
  const columns = schema.definitions.pacientes.properties;
  assert.match(columns.id_persona.description, /personas.id_persona/);
  for (const col of ['dni','nombres','apellidos','telefono','email']) assert.ok(!(col in columns));
  report.checks.push('Esquema remoto: FK pacientes-personas y sin columnas personales antiguas');
  const zone = await fixture('zonas','nombre','TEST_ZONA',
    { nombre: 'TEST_ZONA', descripcion: 'Pruebas de desarrollo SAPS API' },'id_zona');
  const barrio = await fixture('barrios','nombre','Barrio Test API',
    { nombre: 'Barrio Test API', id_zona: zone.id_zona },'id_barrio');
  const salita = await fixture('salitas','codigo','TEST_API',
    { codigo: 'TEST_API', nombre: 'SAPS Test API', direccion: 'Direccion de prueba',
      id_barrio: barrio.id_barrio },'id_salita');
  let coverage = await query(db.from('salita_barrios').select('*')
    .eq('id_salita', salita.id_salita).eq('id_barrio', barrio.id_barrio).maybeSingle());
  const coverageCreated = !coverage;
  if (!coverage) coverage = await query(db.from('salita_barrios').insert({
    id_salita: salita.id_salita, id_barrio: barrio.id_barrio, es_barrio_sede: true
  }).select('*').single());
  report.records.push({ table: 'salita_barrios', id_salita: salita.id_salita,
    id_barrio: barrio.id_barrio, created: coverageCreated });
  const uncovered = await fixture('barrios','nombre','Barrio Test API Sin Cobertura',
    { nombre: 'Barrio Test API Sin Cobertura', id_zona: zone.id_zona },'id_barrio');
  assert.equal((await query(db.from('salita_barrios').select('id_barrio')
    .eq('id_salita', salita.id_salita).eq('id_barrio', uncovered.id_barrio))).length, 0);
  adminToken = await loginFixture('SUPER_ADMIN');
  const patientToken = await loginFixture('PACIENTE');
  const input = { dni: '40999888', nombres: 'Paciente', apellidos: 'Prueba API',
    fecha_nacimiento: '1990-05-20', sexo: 'MASCULINO', telefono: '3777000000',
    email: 'paciente.prueba@example.com', direccion: 'Direccion de prueba',
    localidad: 'Goya', provincia: 'Corrientes', codigo_postal: '3450',
    id_barrio: barrio.id_barrio, id_salita_asignada: salita.id_salita,
    obra_social: 'PRUEBA', numero_afiliado: 'TEST001',
    contacto_emergencia_nombre: 'Contacto Prueba', contacto_emergencia_telefono: '3777111111' };
  await request('POST sin JWT','POST','/api/patients',401,input);
  await request('POST invalido','POST','/api/patients',400,{ dni: '123' },adminToken);
  const previous = await query(db.from('personas').select('id_persona,nombres,apellidos')
    .eq('dni',input.dni).maybeSingle());
  if (previous) {
    assert.equal(previous.nombres,input.nombres); assert.equal(previous.apellidos,input.apellidos);
  }
  const priorPatient = previous && await query(db.from('pacientes').select('id_paciente')
    .eq('id_persona',previous.id_persona).maybeSingle());
  const created = await request('POST paciente','POST','/api/patients',priorPatient ? 409 : 201,input,adminToken);
  patientId = priorPatient?.id_paciente ?? created.data.patient.id_paciente;
  const person = await query(db.from('personas').select('id_persona,activo').eq('dni',input.dni).single());
  report.records.push({ table:'personas',id:person.id_persona,created:!previous });
  report.records.push({ table:'pacientes',id:patientId,created:!priorPatient });
  await request('DNI duplicado','POST','/api/patients',409,input,adminToken);
  assert.equal((await query(db.from('personas').select('id_persona').eq('dni',input.dni))).length,1);
  assert.equal((await query(db.from('pacientes').select('id_paciente').eq('id_persona',person.id_persona))).length,1);
  report.checks.push('DNI 40999888: exactamente una persona y un paciente');
  const list = await request('Listado','GET','/api/patients',200,undefined,adminToken);
  assert.ok(list.data.patients.some(p => p.id_paciente === patientId));
  for (const path of [`/api/patients/${patientId}`,`/api/patients/dni/${input.dni}`]) {
    const result = await request('Lectura plana','GET',path,200,undefined,adminToken);
    assert.equal(result.data.patient.id_persona,person.id_persona);
    assert.equal(result.data.patient.dni,input.dni);
    assert.ok(!('persona' in result.data.patient));
  }
  await request('PATCH mixto','PATCH',`/api/patients/${patientId}`,200,
    { telefono:'3777222222',obra_social:'IOSCOR' },adminToken);
  const updatedPerson = await query(db.from('personas').select('telefono,activo').eq('id_persona',person.id_persona).single());
  const updatedPatient = await query(db.from('pacientes').select('obra_social').eq('id_paciente',patientId).single());
  assert.equal(updatedPerson.telefono,'3777222222'); assert.equal(updatedPatient.obra_social,'IOSCOR');
  report.checks.push('PATCH: telefono en personas y obra_social en pacientes');
  await request('Desactivar','PATCH',`/api/patients/${patientId}/status`,200,{activo:false},adminToken);
  assert.equal((await query(db.from('personas').select('activo').eq('id_persona',person.id_persona).single())).activo,person.activo);
  const inactiveList = await request('Listado sin inactivo','GET','/api/patients',200,undefined,adminToken);
  assert.ok(!inactiveList.data.patients.some(p => p.id_paciente === patientId));
  const inactive = await request('Leer inactivo','GET',`/api/patients/${patientId}`,200,undefined,adminToken);
  assert.equal(inactive.data.patient.activo,false);
  await request('Reactivar','PATCH',`/api/patients/${patientId}/status`,200,{activo:true},adminToken);
  report.checks.push('Estado afecta solo pacientes; inactivo consultable por ID y excluido de listado');
  await request('UUID invalido','GET','/api/patients/no-uuid',400,undefined,adminToken);
  await request('UUID inexistente','GET',`/api/patients/${randomUUID()}`,404,undefined,adminToken);
  await request('PATCH vacio','PATCH',`/api/patients/${patientId}`,400,{},adminToken);
  await request('Sin cobertura','PATCH',`/api/patients/${patientId}`,400,
    {id_barrio:uncovered.id_barrio,telefono:'3777999999'},adminToken);
  assert.equal((await query(db.from('personas').select('telefono').eq('id_persona',person.id_persona).single())).telefono,'3777222222');
  assert.equal((await query(db.from('pacientes').select('id_barrio').eq('id_paciente',patientId).single())).id_barrio,barrio.id_barrio);
  await request('PACIENTE no puede listar','GET','/api/patients',403,undefined,patientToken);
  report.checks.push('Cobertura rechazada sin cambios en persona ni paciente');
} finally {
  // Incluso ante un fallo, no dejar accesibles las cuentas usadas por el test.
  for (const id of accounts) {
    await query(db.from('usuarios').update({activo:false,password_hash:null}).eq('id_usuario',id));
    await query(db.from('sesiones_refresh').update({fecha_revocacion:new Date().toISOString()})
      .eq('id_usuario',id).is('fecha_revocacion',null));
  }
  report.checks.push('Cuentas de prueba desactivadas, sin password y sesiones revocadas');
  await writeFile(new URL('./patient-live-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
}
