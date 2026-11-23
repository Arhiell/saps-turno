import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createTutorRequestSchema,
  resolveTutorRequestSchema,
} from '../src/validators/tutor-request.validator.js';
import { isAdultOnDate } from '../src/utils/person-age.js';

const request = {
  direccion: 'GESTIONAR_A_OTRO',
  dni_persona_destino: '40111222',
  parentesco: 'Madre',
};

test('La mayoría de edad se calcula en la fecha local y en el día límite', () => {
  assert.equal(isAdultOnDate('2008-05-10', '2026-05-10'), true);
  assert.equal(isAdultOnDate('2008-05-11', '2026-05-10'), false);
});

test('La solicitud exige dirección, DNI y vínculo declarado', () => {
  assert.equal(createTutorRequestSchema.safeParse(request).success, true);
  assert.equal(createTutorRequestSchema.safeParse({ ...request, dni_persona_destino: '123' }).success, false);
  assert.equal(createTutorRequestSchema.safeParse({ ...request, parentesco: ' ' }).success, false);
  assert.equal(createTutorRequestSchema.safeParse({ ...request, id_tutor: 'arbitrary' }).success, false);
});

test('La aprobación requiere atestiguar identidad, documentación y autorización', () => {
  assert.equal(resolveTutorRequestSchema.safeParse({ accion: 'APROBAR' }).success, false);
  assert.equal(resolveTutorRequestSchema.safeParse({
    accion: 'APROBAR',
    identidad_verificada: true,
    documentacion_verificada: true,
    autorizacion_verificada: true,
  }).success, true);
  assert.equal(resolveTutorRequestSchema.safeParse({
    accion: 'APROBAR',
    identidad_verificada: true,
    documentacion_verificada: false,
    autorizacion_verificada: true,
  }).success, false);
});

test('El rechazo exige un motivo y no acepta campos de aprobación', () => {
  assert.equal(resolveTutorRequestSchema.safeParse({ accion: 'RECHAZAR' }).success, false);
  assert.equal(resolveTutorRequestSchema.safeParse({
    accion: 'RECHAZAR',
    motivo_rechazo: 'Documentación incompleta',
  }).success, true);
  assert.equal(resolveTutorRequestSchema.safeParse({
    accion: 'RECHAZAR',
    motivo_rechazo: 'No',
  }).success, false);
});
