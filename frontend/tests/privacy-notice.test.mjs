import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/privacy-notice.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const privacy = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const values = new Map();
const storage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};

beforeEach(() => {
  values.clear();
  globalThis.localStorage = storage;
  globalThis.window = new EventTarget();
});

test('Sin lectura, datos corruptos y consentimientos anteriores no ocultan el nuevo aviso', () => {
  for (const raw of [null, '', '{', '{}', JSON.stringify({
    version: 1, categories: { necessary: true, personalization: true }, decidedAt: new Date().toISOString(),
  })]) assert.equal(privacy.parsePrivacyAcknowledgement(raw), null);
  values.set('cora_privacy_preferences', JSON.stringify({ version: 1 }));
  assert.equal(privacy.getPrivacyNoticeSnapshot(), null);
});

test('Entendido guarda solo versión y fecha, sin modificar sesión ni preferencias del chatbot', () => {
  values.set('cora-launcher:example:PACIENTE', '{"hidden":true}');
  values.set('saps_access_token', 'test-token');
  values.set('saps_refresh_token', 'test-refresh');
  values.set('saps_user', 'test-user');
  const previous = [...values.entries()];
  assert.equal(privacy.acknowledgePrivacyNotice(), true);
  const stored = JSON.parse(values.get(privacy.PRIVACY_NOTICE_STORAGE_KEY));
  assert.deepEqual(Object.keys(stored), ['version', 'acknowledgedAt']);
  assert.deepEqual(privacy.parsePrivacyAcknowledgement(JSON.stringify(stored)), stored);
  assert.equal(stored.version, privacy.PRIVACY_NOTICE_VERSION);
  for (const [key, value] of previous) assert.equal(values.get(key), value);
  assert.equal(values.size, previous.length + 1);
});

test('Otra versión y fechas futuras o inválidas requieren volver a mostrar el aviso', () => {
  const stored = { version: privacy.PRIVACY_NOTICE_VERSION, acknowledgedAt: new Date().toISOString() };
  for (const change of [{ version: stored.version + 1 }, { acknowledgedAt: 'bad' },
    { acknowledgedAt: new Date(Date.now() + 86400000).toISOString() }]) {
    assert.equal(privacy.parsePrivacyAcknowledgement(JSON.stringify({ ...stored, ...change })), null);
  }
});

test('La lectura notifica en la pestaña actual y los cambios de almacenamiento sincronizan otras pestañas', () => {
  let notifications = 0;
  const stop = privacy.subscribePrivacyNotice(() => notifications++);
  privacy.acknowledgePrivacyNotice();
  assert.equal(notifications, 1);
  for (const key of ['saps_user', privacy.PRIVACY_NOTICE_STORAGE_KEY, null]) {
    const event = new Event('storage');
    Object.defineProperty(event, 'key', { value: key });
    window.dispatchEvent(event);
  }
  assert.equal(notifications, 3);
  stop();
  privacy.acknowledgePrivacyNotice();
  assert.equal(notifications, 3);
});

test('El almacenamiento bloqueado no simula una lectura guardada ni emite confirmación', () => {
  globalThis.localStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  let notifications = 0;
  const stop = privacy.subscribePrivacyNotice(() => notifications++);
  assert.equal(privacy.getPrivacyNoticeSnapshot(), null);
  assert.equal(privacy.acknowledgePrivacyNotice(), false);
  assert.equal(notifications, 0);
  stop();
});
