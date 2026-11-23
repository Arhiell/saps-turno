import assert from 'node:assert/strict';
import { env } from '../dist/config/env.js';
import { supabase } from '../dist/config/supabase.js';
import { generateAccessToken } from '../dist/services/jwt.service.js';

assert.ok(process.argv.includes('--development') && env.NODE_ENV === 'development',
  'Estas pruebas requieren --development y NODE_ENV=development');
export const db = supabase;
export const results = [];
export async function query(builder) {
  const { data, error } = await builder;
  if (error) throw new Error(`Supabase ${error.code}: ${error.message}`);
  return data;
}
export async function call(label, method, path, expected, body, token) {
  const response = await fetch(`http://127.0.0.1:${env.PORT}${path}`, {
    method, headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000)
  });
  const json = await response.json();
  results.push({ label, method, path, expected, status: response.status });
  console.log(`${label}: ${response.status}`);
  assert.equal(response.status, expected, `${label}: ${json.message ?? ''}`);
  return json;
}
// JWT de prueba solo en memoria, firmado por el backend; no se alteran credenciales.
export async function adminToken() {
  const role = await query(db.from('roles').select('id_rol').eq('codigo', 'SUPER_ADMIN').single());
  const users = await query(db.from('usuarios').select('id_usuario,email,nombre_usuario')
    .eq('id_rol', role.id_rol).eq('activo', true).limit(1));
  assert.ok(users[0], 'Se necesita un SUPER_ADMIN activo de desarrollo');
  return generateAccessToken({ ...users[0], rol: 'SUPER_ADMIN' });
}
