import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { queue, drained } from "./patient-fixtures.js";
export { queue };
export const id = "11111111-1111-4111-8111-111111111111";
export const other = "22222222-2222-4222-8222-222222222222";
export const user = { id_usuario: id, email: "test@example.com", nombre_usuario: "test", rol: "SUPER_ADMIN" };
export const row = { id_configuracion: id, id_salita: null, clave: "turnos.dias_anticipacion", valor: 30,
  descripcion: "Días de anticipación", es_publica: true, actualizado_por: id,
  fecha_creacion: "2026-01-01", fecha_actualizacion: "2026-01-01" };
export const local = { ...row, id_salita: id, clave: "agenda.intervalo_default", es_publica: false };
export const auth = (role = "SUPER_ADMIN") => [
  { table: "usuarios", result: [{ ...user, id_rol: id, activo: true }] },
  { table: "roles", result: [{ codigo: role, activo: true }] },
];
export const scope = { table: "usuario_salita", result: [{ id_salita: id }], check: (url: URL) => {
  assert.equal(url.searchParams.get("id_usuario"), "eq." + id);
  assert.equal(url.searchParams.get("activo"), "eq.true");
  assert.ok(url.searchParams.has("fecha_desde")); assert.ok(url.searchParams.has("or"));
} };
export const config = (result: unknown = [row]) => ({ table: "configuracion", result });
const originalFetch = globalThis.fetch;
let errors: unknown[] = [];
globalThis.fetch = async (...args) => {
  try { return await originalFetch(...args); }
  catch (error) { errors.push(error); throw error; }
};
export const checked = () => { const failures = errors; errors = []; assert.deepEqual(failures, []); drained(); };

export const curl = (server: Server, token: string, method = "GET", path = "", body?: unknown, authenticated = true): Promise<{
  status: number; headers: string; json: any;
}> => new Promise((resolve, reject) => {
  const bash = process.env.GIT_BASH ?? (existsSync("C:/Program Files/Git/bin/bash.exe") ? "C:/Program Files/Git/bin/bash.exe" : "bash");
  const command = 'curl --silent --show-error --max-time 60 --include -X "$CONFIG_METHOD" -H "Authorization: $CONFIG_AUTH" -H "Content-Type: application/json" ${CONFIG_HAS_BODY:+--data-binary @-} "$CONFIG_URL"';
  const child = execFile(bash, ["-c", command], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, CONFIG_METHOD: method, CONFIG_AUTH: authenticated ? `Bearer ${token}` : "",
      CONFIG_HAS_BODY: body === undefined ? "" : "1",
      CONFIG_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/configuracion${path}` } }, (error, stdout) => {
    if (error) return reject(error);
    try {
      const split = stdout.indexOf("\r\n\r\n"); const headers = stdout.slice(0, split);
      resolve({ status: Number(headers.split(" ")[1]), headers, json: JSON.parse(stdout.slice(split + 4)) });
    } catch (error) { reject(error); }
  });
  child.stdin!.end(body === undefined ? undefined : JSON.stringify(body));
});
