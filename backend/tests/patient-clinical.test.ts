import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { input, person, row, queue, drained } from './patient-fixtures.js';
import type { AuthenticatedUser } from '../src/types/auth.types.js';

const { getOwnHistoriaClinica } = await import('../src/services/patient-clinical.service.js');

afterEach(drained);

const userPatient: AuthenticatedUser = {
  id_usuario: '11111111-2222-3333-4444-555555555555',
  id_persona: person.id_persona,
  nombre_usuario: 'juan.perez',
  rol: 'PACIENTE',
  activo: true,
};

const userOtherRole: AuthenticatedUser = {
  id_usuario: '22222222-3333-4444-5555-666666666666',
  id_persona: '99999999-9999-9999-9999-999999999999',
  nombre_usuario: 'profesional.test',
  rol: 'PROFESIONAL',
  activo: true,
};

const mockUserAccount = {
  id_usuario: userPatient.id_usuario,
  id_persona: person.id_persona,
  activo: true,
};

test('1. Rol no PACIENTE es rechazado con 403', async () => {
  await assert.rejects(
    getOwnHistoriaClinica(userOtherRole),
    (err: any) => err.statusCode === 403
  );
});

test('2. Paciente sin expediente clínico retorna estructura limpia sin errores ni consultas ficticias', async () => {
  queue(
    // 0. findUserById
    { table: 'usuarios', result: [mockUserAccount] },
    // 1. currentRelations -> getOwnEntity
    { table: 'pacientes', result: [{ id_paciente: row.id_paciente }] },
    // 2. findPatientById
    { table: 'pacientes', result: [row] },
    // 3. tutores query
    { table: 'tutores', result: [] },
    // 4. findPatientHistoriaClinica -> datos paciente
    {
      table: 'pacientes',
      result: {
        id_paciente: row.id_paciente,
        id_salita_asignada: row.id_salita_asignada,
        id_barrio: row.id_barrio,
        obra_social: 'OSDE',
        numero_afiliado: '12345',
        persona: {
          dni: person.dni,
          nombres: person.nombres,
          apellidos: person.apellidos,
          fecha_nacimiento: person.fecha_nacimiento,
          sexo: person.sexo,
        },
        salita: { nombre: 'Salita Central' },
      },
    },
    // 5. historias_clinicas query (retorna null/vacío)
    { table: 'historias_clinicas', result: null },
    // 6. derivaciones query
    { table: 'autorizaciones_derivaciones_clinicas', result: [] }
  );

  const result = await getOwnHistoriaClinica(userPatient);

  assert.equal(result.paciente.id_paciente, row.id_paciente);
  assert.equal(result.paciente.dni, person.dni);
  assert.equal(result.paciente.nombres, person.nombres);
  assert.equal(result.historia_clinica, null);
  assert.deepEqual(result.consultas, []);
  assert.deepEqual(result.derivaciones, []);
  assert.deepEqual(result.antecedentes, []);
  assert.deepEqual(result.alergias, []);
});

test('3. Paciente con consultas: filtra estrictamente estado FIRMADA y organiza cronológicamente', async () => {
  const hcId = '55555555-5555-5555-5555-555555555555';
  const idConsulta = '66666666-6666-6666-6666-666666666666';

  queue(
    // 0. findUserById
    { table: 'usuarios', result: [mockUserAccount] },
    // 1. currentRelations -> getOwnEntity
    { table: 'pacientes', result: [{ id_paciente: row.id_paciente }] },
    // 2. findPatientById
    { table: 'pacientes', result: [row] },
    // 3. tutores query
    { table: 'tutores', result: [] },
    // 4. findPatientHistoriaClinica -> datos paciente
    {
      table: 'pacientes',
      result: {
        id_paciente: row.id_paciente,
        id_salita_asignada: row.id_salita_asignada,
        id_barrio: row.id_barrio,
        obra_social: null,
        numero_afiliado: null,
        persona: {
          dni: person.dni,
          nombres: person.nombres,
          apellidos: person.apellidos,
          fecha_nacimiento: person.fecha_nacimiento,
          sexo: person.sexo,
        },
        salita: { nombre: 'Salita Central' },
      },
    },
    // 5. historias_clinicas query
    {
      table: 'historias_clinicas',
      result: {
        id_historia_clinica: hcId,
        numero_historia_clinica: 'HC-001',
        fecha_apertura: '2026-01-01',
        grupo_sanguineo: 'O',
        factor_rh: 'POSITIVO',
        activo: true,
      },
    },
    // 6. antecedentes
    { table: 'antecedentes_clinicos', result: [] },
    // 7. alergias
    { table: 'alergias_paciente', result: [] },
    // 8. derivaciones
    { table: 'autorizaciones_derivaciones_clinicas', result: [] },
    // 9. consultas_medicas (comprueba que exige estado=eq.FIRMADA)
    {
      table: 'consultas_medicas',
      check: (url) => {
        assert.equal(url.searchParams.get('estado'), 'eq.FIRMADA');
        assert.equal(url.searchParams.get('id_historia_clinica'), `eq.${hcId}`);
      },
      result: [
        {
          id_consulta: idConsulta,
          fecha_atencion: '2026-11-10T10:00:00Z',
          fecha_firma: '2026-11-10T10:30:00Z',
          motivo_consulta: 'Control periódico',
          anamnesis_cuadro_clinico: 'Paciente asintomático.',
          examen_fisico: 'Normotenso.',
          plan_terapeutico: 'Continuar plan preventivo.',
          estado: 'FIRMADA',
          especialidad: { nombre: 'Clínica Médica' },
          salita: { nombre: 'Salita Central', direccion: 'San Martín 450' },
          profesional: {
            matricula: 'MP-8899',
            persona: { apellidos: 'Gomez', nombres: 'Laura' },
          },
        },
      ],
    },
    // 10. diagnosticos
    {
      table: 'diagnosticos_clinicos',
      result: [
        {
          id_diagnostico: '77777777-7777-7777-7777-777777777777',
          id_consulta: idConsulta,
          codigo_cie10: 'Z00.0',
          descripcion: 'Examen médico general',
          tipo: 'DEFINITIVO',
          es_principal: true,
          cronico: false,
        },
      ],
    },
    // 11. evoluciones (comprueba estado=eq.FIRMADA)
    {
      table: 'evoluciones_clinicas',
      check: (url) => {
        assert.equal(url.searchParams.get('estado'), 'eq.FIRMADA');
      },
      result: [],
    },
    // 12. tratamientos
    { table: 'tratamientos_clinicos', result: [] },
    // 13. estudios
    { table: 'estudios_clinicos', result: [] }
  );

  const result = await getOwnHistoriaClinica(userPatient);

  assert.equal(result.consultas.length, 1);
  assert.equal(result.consultas[0].motivo_consulta, 'Control periódico');
  assert.equal(result.consultas[0].especialidad, 'Clínica Médica');
  assert.equal(result.consultas[0].profesional, 'Gomez, Laura');
  assert.equal(result.consultas[0].matricula_profesional, 'MP-8899');
  assert.equal(result.consultas[0].diagnosticos.length, 1);
  assert.equal(result.consultas[0].diagnosticos[0].descripcion, 'Examen médico general');
  assert.equal(result.historia_clinica?.numero_historia_clinica, 'HC-001');
});

test('4. Paciente intentando acceder a ID ajeno sin relación de tutoría es bloqueado con 403', async () => {
  const otherPatientId = '88888888-8888-8888-8888-888888888888';

  queue(
    // 0. findUserById
    { table: 'usuarios', result: [mockUserAccount] },
    // 1. currentRelations -> getOwnEntity
    { table: 'pacientes', result: [{ id_paciente: row.id_paciente }] },
    // 2. findPatientById
    { table: 'pacientes', result: [row] },
    // 3. tutores query (no tiene perfil de tutor)
    { table: 'tutores', result: [] }
  );

  await assert.rejects(
    getOwnHistoriaClinica(userPatient, otherPatientId),
    (err: any) => err.statusCode === 403
  );
});

test('5. Paciente tutor con relación vigente y autorizada accede a la historia clínica de su persona a cargo', async () => {
  const minorPatientId = '99999999-8888-7777-6666-555555555555';
  const tutorId = '77777777-6666-5555-4444-333333333333';
  const minorRow = {
    ...row,
    id_paciente: minorPatientId,
    persona: {
      ...person,
      dni: '55666777',
      nombres: 'Mateo',
      apellidos: 'Perez',
    },
  };

  queue(
    // 0. findUserById
    { table: 'usuarios', result: [mockUserAccount] },
    // 1. currentRelations -> getOwnEntity
    { table: 'pacientes', result: [{ id_paciente: row.id_paciente }] },
    // 2. findPatientById titular
    { table: 'pacientes', result: [row] },
    // 3. tutores query titular
    { table: 'tutores', result: [{ id_tutor: tutorId }] },
    // 4. paciente_tutores query con autorización verificada y vigente
    {
      table: 'paciente_tutores',
      result: [
        {
          id_paciente: minorPatientId,
          parentesco: 'HIJO',
          fecha_desde: '2020-01-01',
          fecha_hasta: null,
        },
      ],
    },
    // 5. findPatientById tutelado (resolveManagedPatient)
    { table: 'pacientes', result: [minorRow] },
    // 6. findPatientHistoriaClinica datos tutelado
    {
      table: 'pacientes',
      result: {
        id_paciente: minorPatientId,
        id_salita_asignada: minorRow.id_salita_asignada,
        id_barrio: minorRow.id_barrio,
        obra_social: null,
        numero_afiliado: null,
        persona: minorRow.persona,
        salita: { nombre: 'Salita Central' },
      },
    },
    // 7. historias_clinicas tutelado (sin consultas)
    { table: 'historias_clinicas', result: null },
    // 8. derivaciones
    { table: 'autorizaciones_derivaciones_clinicas', result: [] }
  );

  const result = await getOwnHistoriaClinica(userPatient, minorPatientId);
  assert.equal(result.paciente.id_paciente, minorPatientId);
  assert.equal(result.paciente.nombres, 'Mateo');
  assert.deepEqual(result.consultas, []);
});
