import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { env } from '../dist/config/env.js';
import { supabase } from '../dist/config/supabase.js';
import { hashPassword } from '../dist/services/password.service.js';

assert.ok(process.argv.includes('--development') && env.NODE_ENV === 'development',
  'Prueba real: requiere --development y NODE_ENV=development');
export const db = supabase;
export const report = { date: new Date().toISOString(), requests: [], records: [], checks: [] };
const accounts = [];
export async function query(builder) {
  const { data, error } = await builder;
  if (error) throw new Error(`Supabase ${error.code}: ${error.message}`);
  return data;
}
export async function request(label, method, path, expected, body, token) {
  const response = await fetch(`http://127.0.0.1:${env.PORT}${path}`, {
    method, headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000)
  });
  const json = await response.json();
  report.requests.push({ label, method, path, expected, status: response.status });
  console.log(`${label}: ${response.status}`);
  assert.equal(response.status, expected, label);
  return json;
}
export async function login(role) {
  const name = `test_api_${role.toLowerCase()}`;
  const user = await query(db.from('usuarios').select('id_usuario,id_rol,activo,email')
    .eq('nombre_usuario', name).single());
  const storedRole = await query(db.from('roles').select('codigo').eq('id_rol', user.id_rol).single());
  assert.equal(storedRole.codigo, role);
  assert.equal(user.activo, false, 'No modificar una cuenta en uso');
  assert.equal(user.email, `${name}@example.com`);
  const password = randomBytes(32).toString('base64url');
  accounts.push(user.id_usuario);
  await query(db.from('usuarios').update({ activo: true,
    password_hash: await hashPassword(password) }).eq('id_usuario', user.id_usuario));
  const response = await request(`Login ${role}`, 'POST', '/api/auth/login', 200,
    { identifier: name, password });
  assert.equal(typeof response.data.accessToken, 'string');
  return response.data.accessToken;
}
export async function finish(filename) {
  // No dejar cuentas de prueba accesibles, incluso si una asercion falla.
  try {
    for (const id of accounts) {
      await query(db.from('usuarios').update({ activo: false, password_hash: null }).eq('id_usuario', id));
      await query(db.from('sesiones_refresh').update({ fecha_revocacion: new Date().toISOString() })
        .eq('id_usuario', id).is('fecha_revocacion', null));
    }
    report.checks.push('Cuentas reutilizadas desactivadas, sin password, sesiones revocadas');
  } finally {
    await writeFile(new URL(filename, import.meta.url), JSON.stringify(report, null, 2) + '\n');
  }
}
