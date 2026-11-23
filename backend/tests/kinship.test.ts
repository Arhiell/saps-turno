import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveManagedKinship } from '../src/utils/kinship.util.js';

test('1. Usuario madre con vínculo guardado "Madre" y dependiente varón muestra "Hijo"', () => {
  // Caso exacto de Sonia Valdez y Roberto Gomez
  const result = resolveManagedKinship({
    storedRelationship: 'Madre',
    userSex: 'FEMENINO',
    userBirthDate: '1980-05-10',
    dependentSex: 'MASCULINO',
    dependentBirthDate: '2010-09-15',
  });
  assert.equal(result, 'Hijo');
});

test('2. Usuario madre con vínculo guardado "Madre" y dependiente mujer muestra "Hija"', () => {
  const result = resolveManagedKinship({
    storedRelationship: 'Madre',
    userSex: 'FEMENINO',
    userBirthDate: '1980-05-10',
    dependentSex: 'FEMENINO',
    dependentBirthDate: '2012-04-20',
  });
  assert.equal(result, 'Hija');
});

test('3. Usuario padre con vínculo guardado "Padre" y dependiente varón muestra "Hijo"', () => {
  const result = resolveManagedKinship({
    storedRelationship: 'Padre',
    userSex: 'MASCULINO',
    userBirthDate: '1978-02-14',
    dependentSex: 'MASCULINO',
    dependentBirthDate: '2008-11-05',
  });
  assert.equal(result, 'Hijo');
});

test('4. Usuario padre con vínculo guardado "Padre" y dependiente mujer muestra "Hija"', () => {
  const result = resolveManagedKinship({
    storedRelationship: 'Padre',
    userSex: 'MASCULINO',
    userBirthDate: '1978-02-14',
    dependentSex: 'FEMENINO',
    dependentBirthDate: '2011-07-22',
  });
  assert.equal(result, 'Hija');
});

test('5. Usuario hijo adulto que gestiona a su madre dependiente muestra "Madre"', () => {
  // Vínculo guardado como "Hijo" o "Madre", pero el dependiente es mayor
  const resultConHijo = resolveManagedKinship({
    storedRelationship: 'Hijo',
    userSex: 'MASCULINO',
    userBirthDate: '1995-03-10', // 31 años
    dependentSex: 'FEMENINO',
    dependentBirthDate: '1960-08-25', // 66 años
  });
  assert.equal(resultConHijo, 'Madre');

  const resultConMadre = resolveManagedKinship({
    storedRelationship: 'Madre',
    userSex: 'MASCULINO',
    userBirthDate: '1995-03-10',
    dependentSex: 'FEMENINO',
    dependentBirthDate: '1960-08-25',
  });
  assert.equal(resultConMadre, 'Madre');
});

test('6. Usuario hija adulta que gestiona a su padre dependiente muestra "Padre"', () => {
  const result = resolveManagedKinship({
    storedRelationship: 'Hija',
    userSex: 'FEMENINO',
    userBirthDate: '1992-06-12',
    dependentSex: 'MASCULINO',
    dependentBirthDate: '1955-12-01',
  });
  assert.equal(result, 'Padre');
});

test('7. Vínculo de hermanos muestra "Hermano" o "Hermana" según el dependiente', () => {
  const hermano = resolveManagedKinship({
    storedRelationship: 'Hermano',
    userSex: 'FEMENINO',
    dependentSex: 'MASCULINO',
  });
  assert.equal(hermano, 'Hermano');

  const hermana = resolveManagedKinship({
    storedRelationship: 'Hermana',
    userSex: 'MASCULINO',
    dependentSex: 'FEMENINO',
  });
  assert.equal(hermana, 'Hermana');
});

test('8. Vínculo de tutor legal muestra "Persona tutelada"', () => {
  assert.equal(
    resolveManagedKinship({
      storedRelationship: 'Tutor legal',
      dependentSex: 'MASCULINO',
    }),
    'Persona tutelada'
  );

  assert.equal(
    resolveManagedKinship({
      storedRelationship: 'Tutora',
      dependentSex: 'FEMENINO',
    }),
    'Persona tutelada'
  );

  assert.equal(
    resolveManagedKinship({
      storedRelationship: 'Tutor/a',
      dependentSex: 'NO_INFORMA',
    }),
    'Persona tutelada'
  );

  assert.equal(
    resolveManagedKinship({
      storedRelationship: 'Representante legal',
      dependentSex: 'MASCULINO',
    }),
    'Persona tutelada'
  );
});

test('9. Vínculo guardado ya en sentido dependiente ("Hijo") se preserva correctamente', () => {
  const hijo = resolveManagedKinship({
    storedRelationship: 'Hijo',
    userSex: 'FEMENINO',
    dependentSex: 'MASCULINO',
    userBirthDate: '1982-01-01',
    dependentBirthDate: '2015-05-01',
  });
  assert.equal(hijo, 'Hijo');

  const hija = resolveManagedKinship({
    storedRelationship: 'Hija',
    userSex: 'MASCULINO',
    dependentSex: 'FEMENINO',
    userBirthDate: '1982-01-01',
    dependentBirthDate: '2015-05-01',
  });
  assert.equal(hija, 'Hija');
});

test('10. Vínculos de abuelos y tíos se resuelven de acuerdo al parentesco recíproco', () => {
  // Abuelo gestionando a su nieto
  const nieto = resolveManagedKinship({
    storedRelationship: 'Abuelo',
    userSex: 'MASCULINO',
    userBirthDate: '1950-01-01',
    dependentSex: 'MASCULINO',
    dependentBirthDate: '2014-01-01',
  });
  assert.equal(nieto, 'Nieto');

  // Tía gestionando a su sobrina
  const sobrina = resolveManagedKinship({
    storedRelationship: 'Tía',
    userSex: 'FEMENINO',
    userBirthDate: '1985-01-01',
    dependentSex: 'FEMENINO',
    dependentBirthDate: '2016-01-01',
  });
  assert.equal(sobrina, 'Sobrina');
});
