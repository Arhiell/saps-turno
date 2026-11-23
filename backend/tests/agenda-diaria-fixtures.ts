import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

Object.assign(process.env, { SUPABASE_URL: "http://supabase.invalid", SUPABASE_PUBLISHABLE_KEY: "test-key",
  SUPABASE_SECRET_KEY: "test-secret", JWT_ACCESS_SECRET: "agenda-test-secret", GOOGLE_CLIENT_ID: "test-client" });
export const id = "11111111-1111-4111-8111-111111111111";
export const other = "22222222-2222-4222-8222-222222222222";
export const user = { id_usuario: id, email: "test@example.com", nombre_usuario: "test", rol: "SUPER_ADMIN" };
export const row = { id_turno: id, codigo_turno: "T-001", id_paciente: id, id_profesional: id,
  id_salita: id, id_especialidad: id, fecha_hora_inicio: "2026-09-21T11:00:00Z",
  estado: { codigo: "CONFIRMADO", es_estado_final: false }, motivo_consulta: "Control",
  paciente: { persona: { apellidos: "Gómez", nombres: "María", dni: "30111222" } },
  profesional: { persona: { apellidos: "Pérez", nombres: "Juan" } },
  salita: { nombre: "SAPS Norte", direccion: "Belgrano 100" }, especialidad: { nombre: "Clínica Médica" } };
type Step = { table: string; data: unknown; total?: number; status?: number; check?: (url: URL) => void };
let steps: Step[] = [];
let errors: unknown[] = [];
export const queue = (...items: Step[]) => { assert.equal(steps.length, 0); steps.push(...items); };
export const drained = () => {
  const pending = steps.length; const failures = errors;
  steps = []; errors = [];
  assert.deepEqual(failures, []); assert.equal(pending, 0);
};
export const auth = (role = "SUPER_ADMIN"): Step[] => [
  { table: "usuarios", data: [{ ...user, id_rol: id, activo: true }] },
  { table: "roles", data: [{ codigo: role, activo: true }] },
];
export const scope = (salitas = [id]): Step => ({ table: "usuario_salita", data: salitas.map(id_salita => ({ id_salita })), check: url => {
  assert.equal(url.searchParams.get("id_usuario"), "eq." + id);
  assert.equal(url.searchParams.get("activo"), "eq.true");
  assert.ok(url.searchParams.has("fecha_desde")); assert.ok(url.searchParams.has("or"));
} });
export const data = (rows: unknown[] = [row], check?: (url: URL) => void, total = rows.length): Step => ({
  table: "turnos", data: rows, total, check: url => {
    assert.equal(url.searchParams.get("order"), "fecha_hora_inicio.asc,id_turno.asc");
    assert.equal(url.searchParams.get("estado.es_estado_final"), "eq.false");
    assert.equal(url.searchParams.get("estado.codigo"), "not.in.(CANCELADO,REPROGRAMADO)");
    assert.ok(url.searchParams.get("select")?.includes("estado:estados_turno!inner("));
    check?.(url);
  },
});
globalThis.fetch = async (input, options) => {
  try {
    const url = new URL(String(input)); const step = steps.shift();
    assert.ok(step, "Consulta inesperada: " + url);
    assert.equal(url.hostname, "supabase.invalid"); assert.equal(url.pathname, "/rest/v1/" + step.table);
    assert.equal(options?.method ?? "GET", "GET"); step.check?.(url);
    return new Response(JSON.stringify(step.data), { status: step.status ?? 200,
      headers: { "Content-Type": "application/json", "Content-Range": `0-0/${step.total ?? 1}` } });
  } catch (error) { errors.push(error); throw error; }
};

// En Windows ejecuta curl dentro de Git Bash; no requiere un servidor ni credenciales reales.
export const curl = (server: Server, token: string, path: string, authenticated = true): Promise<{
  status: number; headers: string; body: Buffer; json: () => any;
}> => new Promise((resolve, reject) => {
  const bash = process.env.GIT_BASH ?? (existsSync("C:/Program Files/Git/bin/bash.exe") ? "C:/Program Files/Git/bin/bash.exe" : "bash");
  const command = 'curl --silent --show-error --max-time 60 --include -H "Authorization: $AGENDA_AUTH" "$AGENDA_URL"';
  execFile(bash, ["-c", command], { encoding: "buffer", maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, AGENDA_AUTH: authenticated ? `Bearer ${token}` : "",
      AGENDA_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/reportes/agenda-diaria${path}` } }, (error, stdout) => {
    if (error) return reject(error);
    const split = stdout.indexOf("\r\n\r\n");
    const headers = stdout.subarray(0, split).toString(); const body = stdout.subarray(split + 4);
    resolve({ status: Number(headers.split(" ")[1]), headers, body, json: () => JSON.parse(body.toString()) });
  });
});
