import assert from 'node:assert/strict';
import { env } from '../dist/config/env.js';

const cases = [
  ...['health', 'health/database', 'users/health', 'barrios', 'zonas', 'salitas', 'especialidades']
    .map(path => ['GET', `/api/${path}`, 200]),
  ['GET', '/api/ruta-inexistente', 404],
  ...['auth/register', 'auth/login', 'auth/refresh', 'auth/logout', 'auth/email/request',
    'auth/email/verify', 'auth/password/forgot', 'auth/password/reset', 'auth/google']
    .map(path => ['POST', `/api/${path}`, 400]),
  ...['users/admins', 'users/patients'].map(path => ['POST', `/api/${path}`, 401]),
  ...['patients', 'tutors'].map(path => ['GET', `/api/${path}`, 401]),
];
for (const [method, path, expected] of cases) {
  const response = await fetch(`http://127.0.0.1:${env.PORT}${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: '{}' } : {}), signal: AbortSignal.timeout(20000),
  });
  const json = await response.json();
  assert.equal(response.status, expected, `${method} ${path}`);
  assert.equal(json.success, expected < 400, `${method} ${path}: success`);
  console.log(`${method} ${path}: ${response.status}`);
}
console.log(`${cases.length} comprobaciones HTTP correctas`);
