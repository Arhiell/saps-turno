import assert from 'node:assert/strict';
import { after, afterEach, mock, test } from 'node:test';
import nodemailer from 'nodemailer';
import { queue, drained } from './patient-fixtures.js';

Object.assign(process.env, {
  MAIL_HOST: 'smtp.invalid', MAIL_PORT: '587', MAIL_SECURE: 'false',
  MAIL_USER: 'sender@example.test', MAIL_PASSWORD: 'test-password',
  MAIL_FROM_NAME: 'Test', MAIL_FROM_EMAIL: 'sender@example.test',
});

const messages: { to: string; text: string }[] = [];
let rejectMail = false;
// Intercepta SMTP antes de importar el servicio: nunca se envían correos reales.
mock.method(nodemailer, 'createTransport', () => ({
  sendMail: async (message: { to: string; text: string }) => {
    if (rejectMail) throw new Error('SMTP no disponible');
    messages.push(message);
    return { accepted: [message.to] };
  },
}));

const { requestEmailVerification, verifyEmailCode, verifyUserEmail } =
  await import('../src/services/email-verification.service.js');
const { hashEmailVerificationCode } =
  await import('../src/services/email-verification-token.service.js');

const id = '11111111-1111-4111-8111-111111111111';
const admin = {
  id_usuario: id, email: 'admin@example.test', activo: true,
  email_verificado: false, rol: 'ADMIN_SALITA',
};

afterEach(() => {
  drained();
  messages.length = 0;
  rejectMail = false;
});
after(() => mock.restoreAll());

test('Administrador existente puede solicitar y confirmar un código sin volver a crear la cuenta', async () => {
  let storedHash: unknown;
  queue(
    { table: 'usuarios', result: [admin] },
    { table: 'tokens_verificacion_email', result: [] },
    { table: 'rpc/emitir_codigo_email', method: 'POST', result: id,
      check: (_url, body) => {
        assert.equal(body?.p_usuario, id);
        assert.equal(body?.p_nuevo_email, null);
        storedHash = body?.p_hash;
      } },
  );
  const result = await requestEmailVerification({ email: ' ADMIN@example.test ' }, null);
  assert.ok(result?.verificationExpiresAt);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, admin.email);
  const code = messages[0].text.match(/\b\d{4}\b/)?.[0];
  assert.ok(code);
  assert.equal(storedHash, hashEmailVerificationCode(id, code));
  drained();

  queue(
    { table: 'usuarios', result: [admin] },
    { table: 'rpc/consumir_codigo_email', method: 'POST', result: 'OK',
      check: (_url, body) => {
        assert.equal(body?.p_usuario, id);
        assert.equal(body?.p_hash, storedHash);
        assert.equal(body?.p_nuevo_email, null);
      } },
  );
  await verifyEmailCode({ email: admin.email, code });
});

test('Reenvío respeta la espera de un minuto y no envía otro correo', async () => {
  const createdAt = new Date().toISOString();
  const expiration = new Date(Date.now() + 600_000).toISOString();
  queue(
    { table: 'usuarios', result: [admin] },
    { table: 'tokens_verificacion_email', result: [{
      id_token: id, fecha_creacion: createdAt, fecha_expiracion: expiration,
      intentos: 0, nuevo_email: null, email_anterior: null,
    }] },
  );
  const result = await requestEmailVerification({ email: admin.email }, null);
  assert.equal(result?.verificationExpiresAt, expiration);
  assert.equal(Date.parse(result!.resendAvailableAt), Date.parse(createdAt) + 60_000);
  assert.equal(messages.length, 0);
});

test('El error de columna faltante no se oculta ni se anuncia un envío exitoso', async () => {
  queue(
    { table: 'usuarios', result: [admin] },
    { table: 'tokens_verificacion_email', status: 400, result: {
      code: '42703', message: 'column tokens_verificacion_email.nuevo_email does not exist',
    } },
  );
  await assert.rejects(requestEmailVerification({ email: admin.email }, null), /nuevo_email does not exist/);
  assert.equal(messages.length, 0);
});

test('Un fallo SMTP invalida el código emitido y devuelve 503', async () => {
  rejectMail = true;
  queue(
    { table: 'usuarios', result: [admin] },
    { table: 'tokens_verificacion_email', result: [] },
    { table: 'rpc/emitir_codigo_email', method: 'POST', result: id },
    { table: 'tokens_verificacion_email', method: 'PATCH', result: null,
      check: (url, body) => {
        assert.equal(url.searchParams.get('id_token'), `eq.${id}`);
        assert.ok(body?.fecha_uso);
      } },
  );
  await assert.rejects(requestEmailVerification({ email: admin.email }, null), { statusCode: 503 });
});

for (const [rpcResult, statusCode] of [['INVALIDO', 400], ['EXPIRADO', 400], ['INTENTOS', 429]] as const) {
  test(`Verificación rechaza ${rpcResult} sin marcar la cuenta desde el backend`, async () => {
    queue(
      { table: 'usuarios', result: [admin] },
      { table: 'rpc/consumir_codigo_email', method: 'POST', result: rpcResult },
    );
    await assert.rejects(verifyEmailCode({ email: admin.email, code: '0123' }), { statusCode });
  });
}

test('El enlace anterior sigue verificando únicamente tokens de alta, no de cambio de correo', async () => {
  queue(
    { table: 'tokens_verificacion_email', result: [{
      id_token: id, id_usuario: id, fecha_expiracion: new Date(Date.now() + 600_000).toISOString(), fecha_uso: null,
    }], check: url => assert.equal(url.searchParams.get('nuevo_email'), 'is.null') },
    { table: 'tokens_verificacion_email', method: 'PATCH', result: [{ id_token: id }] },
    { table: 'usuarios', method: 'PATCH', result: null,
      check: (_url, body) => assert.equal(body?.email_verificado, true) },
  );
  await verifyUserEmail({ token: 'a'.repeat(64) });
});
