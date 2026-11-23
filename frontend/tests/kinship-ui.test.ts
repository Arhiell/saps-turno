import test from 'node:test';
import assert from 'node:assert/strict';
import { formatManagedKinship } from '../src/utils/kinship.ts';

test('formatManagedKinship: Sonia Valdez (madre) consultando a Roberto Gomez (hijo) muestra "Hijo"', () => {
  const titular = {
    nombres: 'Sonia',
    apellidos: 'Valdez',
    sexo: 'FEMENINO',
    fecha_nacimiento: '1979-04-15',
  };

  const managedRoberto = {
    nombres: 'Roberto',
    apellidos: 'Gomez',
    dni: '45773890',
    sexo: 'MASCULINO',
    fecha_nacimiento: '2011-08-20',
    parentesco: 'Madre',
  };

  const formatted = formatManagedKinship(managedRoberto, titular);
  assert.equal(formatted, 'Hijo');

  // Comprueba el formato exacto del selector
  const selectorLabel = `${managedRoberto.apellidos}, ${managedRoberto.nombres} — DNI ${managedRoberto.dni} (${formatted})`;
  assert.equal(selectorLabel, 'Gomez, Roberto — DNI 45773890 (Hijo)');
});

test('formatManagedKinship: Padre consultando a hija muestra "Hija"', () => {
  const titular = {
    nombres: 'Juan',
    apellidos: 'Gomez',
    sexo: 'MASCULINO',
    fecha_nacimiento: '1975-02-10',
  };

  const managedSofia = {
    nombres: 'Sofia',
    apellidos: 'Gomez',
    dni: '48123456',
    sexo: 'FEMENINO',
    fecha_nacimiento: '2013-05-18',
    parentesco: 'Padre',
  };

  const formatted = formatManagedKinship(managedSofia, titular);
  assert.equal(formatted, 'Hija');
});

test('formatManagedKinship: Hijo adulto consultando a madre muestra "Madre"', () => {
  const titular = {
    nombres: 'Carlos',
    apellidos: 'Perez',
    sexo: 'MASCULINO',
    fecha_nacimiento: '1992-03-01',
  };

  const managedCarmen = {
    nombres: 'Carmen',
    apellidos: 'Gomez',
    dni: '12345678',
    sexo: 'FEMENINO',
    fecha_nacimiento: '1962-09-10',
    parentesco: 'Hijo',
  };

  assert.equal(formatManagedKinship(managedCarmen, titular), 'Madre');
});

test('formatManagedKinship: Hermano y Hermana según sexo del dependiente', () => {
  const titular = {
    nombres: 'Martín',
    apellidos: 'López',
    sexo: 'MASCULINO',
  };

  const hermano = {
    nombres: 'Lucas',
    apellidos: 'López',
    sexo: 'MASCULINO',
    parentesco: 'Hermana', // guardado por error de tipeo o sentido
  };
  assert.equal(formatManagedKinship(hermano, titular), 'Hermano');

  const hermana = {
    nombres: 'Lucía',
    apellidos: 'López',
    sexo: 'FEMENINO',
    parentesco: 'Hermano',
  };
  assert.equal(formatManagedKinship(hermana, titular), 'Hermana');
});

test('formatManagedKinship: Tutor legal muestra "Persona tutelada"', () => {
  const titular = {
    nombres: 'Ana',
    apellidos: 'Suarez',
  };

  const tutelado = {
    nombres: 'Facundo',
    apellidos: 'Rios',
    sexo: 'MASCULINO',
    parentesco: 'Tutor legal',
  };
  assert.equal(formatManagedKinship(tutelado, titular), 'Persona tutelada');

  const tutelada = {
    nombres: 'Camila',
    apellidos: 'Rios',
    sexo: 'FEMENINO',
    parentesco: 'Tutora',
  };
  assert.equal(formatManagedKinship(tutelada, titular), 'Persona tutelada');
});
