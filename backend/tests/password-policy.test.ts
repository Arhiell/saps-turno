import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordPolicySchema, registerSchema } from '../src/validators/auth.validator.js';
import { passwordChangeSchema } from '../src/validators/account.validator.js';
import { resetPasswordSchema } from '../src/validators/password-recovery.validator.js';

test('Password policy validation - valid passwords', () => {
  const validPasswords = [
    'Raul1234',
    'Profesional2026',
    'CoraSalud2026',
    'Cora2026!',
    'Clave_1234',
    'Abcde123', // exactly 8 chars
    'Abcdefghij1234567890', // exactly 20 chars
    'Pass1234#$',
  ];

  for (const password of validPasswords) {
    const result = passwordPolicySchema.safeParse(password);
    assert.equal(result.success, true, `Expected "${password}" to be valid`);
  }
});

test('Password policy validation - invalid passwords rejected', () => {
  const invalidCases: Array<{ password: string; reason: string }> = [
    { password: '', reason: 'empty' },
    { password: 'Ab1', reason: 'too short (<8)' },
    { password: 'Raul123', reason: '7 chars (<8)' },
    { password: 'Abcdefghij12345678901', reason: '21 chars (>20)' },
    { password: 'raul1234', reason: 'missing uppercase' },
    { password: 'RAUL1234', reason: 'missing lowercase' },
    { password: 'RaulAbcd', reason: 'missing digit' },
    { password: '       ', reason: 'only whitespace' },
  ];

  for (const { password, reason } of invalidCases) {
    const result = passwordPolicySchema.safeParse(password);
    assert.equal(result.success, false, `Expected "${password}" to fail due to: ${reason}`);
  }
});

test('Derived schemas enforce same password policy', () => {
  // registerSchema
  const validRegister = registerSchema.safeParse({
    nombre_usuario: 'juan_perez',
    email: 'juan@cora.salud.gob.ar',
    password: 'Raul1234',
  });
  assert.equal(validRegister.success, true);

  const invalidRegisterTooLong = registerSchema.safeParse({
    nombre_usuario: 'juan_perez',
    email: 'juan@cora.salud.gob.ar',
    password: 'Raul123456789012345678901',
  });
  assert.equal(invalidRegisterTooLong.success, false);

  // passwordChangeSchema
  const validChange = passwordChangeSchema.safeParse({
    currentPassword: 'OldPassword123',
    newPassword: 'Profesional2026',
  });
  assert.equal(validChange.success, true);

  const invalidChangeNoNumber = passwordChangeSchema.safeParse({
    currentPassword: 'OldPassword123',
    newPassword: 'ProfesionalSinNumero',
  });
  assert.equal(invalidChangeNoNumber.success, false);

  // resetPasswordSchema
  const validReset = resetPasswordSchema.safeParse({
    token: 'a'.repeat(64),
    newPassword: 'CoraSalud2026',
  });
  assert.equal(validReset.success, true);
});
