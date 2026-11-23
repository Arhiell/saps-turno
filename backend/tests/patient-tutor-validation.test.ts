import assert from 'node:assert/strict';
import { test } from 'node:test';
import { updatePatientTutorSchema } from '../src/validators/patient-tutor.validator.js';

test('La edición de una relación no puede cambiar la vigencia ni el permiso de gestión', () => {
  for (const value of [true, false]) {
    assert.equal(updatePatientTutorSchema.safeParse({
      parentesco: 'Madre',
      puede_gestionar_turnos: value,
    }).success, false);
  }
  assert.equal(updatePatientTutorSchema.safeParse({
    fecha_desde: '2026-01-01',
    fecha_hasta: null,
  }).success, false);
  assert.equal(updatePatientTutorSchema.safeParse({ parentesco: 'Madre' }).success, true);
});
