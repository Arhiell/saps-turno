import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePasswordRequirements,
  validatePassword,
  validateConfirmation,
  passwordError,
} from '../src/utils/password-policy.ts';

test('evaluatePasswordRequirements: real-time checklist feedback', () => {
  // Step 1: Just starting to type "R"
  const step1 = evaluatePasswordRequirements('R');
  assert.equal(step1.hasLength, false);
  assert.equal(step1.hasUpper, true);
  assert.equal(step1.hasLower, false);
  assert.equal(step1.hasNumber, false);
  assert.equal(step1.hasSpecial, false);
  assert.equal(step1.isValid, false);

  // Step 2: "Raul"
  const step2 = evaluatePasswordRequirements('Raul');
  assert.equal(step2.hasLength, false);
  assert.equal(step2.hasUpper, true);
  assert.equal(step2.hasLower, true);
  assert.equal(step2.hasNumber, false);
  assert.equal(step2.isValid, false);

  // Step 3: "Raul123" (7 chars)
  const step3 = evaluatePasswordRequirements('Raul123');
  assert.equal(step3.hasLength, false);
  assert.equal(step3.hasUpper, true);
  assert.equal(step3.hasLower, true);
  assert.equal(step3.hasNumber, true);
  assert.equal(step3.isValid, false);

  // Step 4: "Raul1234" (8 chars - complete)
  const step4 = evaluatePasswordRequirements('Raul1234');
  assert.equal(step4.hasLength, true);
  assert.equal(step4.hasUpper, true);
  assert.equal(step4.hasLower, true);
  assert.equal(step4.hasNumber, true);
  assert.equal(step4.hasSpecial, false); // optional
  assert.equal(step4.isValid, true);

  // Step 5: "Profesional2026" (valid)
  const step5 = evaluatePasswordRequirements('Profesional2026');
  assert.equal(step5.hasLength, true);
  assert.equal(step5.isValid, true);

  // Step 6: "CoraSalud2026!" (valid with optional symbol)
  const step6 = evaluatePasswordRequirements('CoraSalud2026!');
  assert.equal(step6.hasLength, true);
  assert.equal(step6.hasSpecial, true);
  assert.equal(step6.isValid, true);

  // Step 7: Exceeding 20 chars
  const step7 = evaluatePasswordRequirements('Raul1234567890123456789'); // 23 chars
  assert.equal(step7.hasLength, false);
  assert.equal(step7.isValid, false);
});

test('validatePassword: field-level error messages directly under password input', () => {
  assert.equal(validatePassword(''), 'La contraseña es obligatoria.');
  assert.equal(validatePassword('   '), 'La contraseña es obligatoria.');
  assert.equal(validatePassword('Raul123456789012345678901'), 'La contraseña no puede superar los 20 caracteres.');
  assert.equal(validatePassword('Raul1'), 'La contraseña debe tener al menos 8 caracteres.');
  assert.equal(validatePassword('raul1234'), 'La contraseña debe contener al menos una mayúscula.');
  assert.equal(validatePassword('RAUL1234'), 'La contraseña debe contener al menos una minúscula.');
  assert.equal(validatePassword('RaulAbcd'), 'La contraseña debe contener al menos un número.');

  // Valid passwords return null
  assert.equal(validatePassword('Raul1234'), null);
  assert.equal(validatePassword('Profesional2026'), null);
  assert.equal(validatePassword('CoraSalud2026'), null);
  assert.equal(validatePassword('Cora2026!'), null);
});

test('validateConfirmation: field-level error messages directly under confirmation input', () => {
  assert.equal(validateConfirmation('Raul1234', ''), 'Debés confirmar la contraseña.');
  assert.equal(validateConfirmation('Raul1234', 'Raul1235'), 'Las contraseñas no coinciden.');
  assert.equal(validateConfirmation('Raul1234', 'Raul1234'), null);
});

test('passwordError: backward compatibility function returns first error or empty string', () => {
  assert.equal(passwordError('', ''), 'La contraseña es obligatoria.');
  assert.equal(passwordError('Raul1234', ''), 'Debés confirmar la contraseña.');
  assert.equal(passwordError('Raul1234', 'Raul1235'), 'Las contraseñas no coinciden.');
  assert.equal(passwordError('Raul1234', 'Raul1234'), '');
});
