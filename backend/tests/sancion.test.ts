import assert from "node:assert/strict";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { after, afterEach, before, test } from "node:test";
import { createSancionSchema, anularSancionSchema, sancionIdSchema, sancionQuerySchema } from "../src/validators/sancion.validator.js";

Object.assign(process.env, {
  SUPABASE_URL: "http://supabase.invalid", SUPABASE_PUBLISHABLE_KEY: "test-key",
  SUPABASE_SECRET_KEY: "test-secret", JWT_ACCESS_SECRET: "test-secret-for-sanctions", GOOGLE_CLIENT_ID: "test-client",
});
type Step = { table: string; data: unknown; method?: string; status?: number; total?: number | null;
  check?: (url: URL, body: Record<string, unknown> | undefined, headers: Headers) => void };
let steps: Step[] = [];
let transportErrors: unknown[] = [];
const queue = (...next: Step[]) => { assert.equal(steps.length, 0); steps.push(...next); };
// Real Express and Supabase client, with database transport fully intercepted.
globalThis.fetch = async (input, options) => {
  try {
    const url = new URL(String(input));
    const step = steps.shift();
    assert.ok(step, "Unexpected database request: " + url);
    assert.equal(url.hostname, "supabase.invalid");
    assert.equal(url.pathname, "/rest/v1/" + step.table);
    assert.equal(options?.method ?? "GET", step.method ?? "GET");
    step.check?.(url, options?.body ? JSON.parse(String(options.body)) : undefined, new Headers(options?.headers));
    return new Response(JSON.stringify(step.data), { status: step.status ?? 200,
      headers: { "Content-Type": "application/json", ...(step.total === null ? {} : { "Content-Range": `0-0/${step.total ?? 1}` }) } });
  } catch (error) { transportErrors.push(error); throw error; }
};
const { default: app } = await import("../src/app.js");
const { generateAccessToken } = await import("../src/services/jwt.service.js");
const { registerSancion, cancelSancion } = await import("../src/services/sancion.service.js");
const id = "11111111-1111-4111-8111-111111111111";
const user = { id_usuario: id, email: "test@example.com", nombre_usuario: "test", rol: "SUPER_ADMIN" };
const input = { id_paciente: id, id_especialidad: id, id_turno: id, motivo: "Inasistencia al turno", fecha_fin: "2099-10-05T10:00:00-03:00" };
const row = { ...input, id_sancion: id, anulada: false, motivo_anulacion: null, anulada_por: null,
  creado_por: id, fecha_inicio: "2026-01-01T00:00:00Z", fecha_creacion: "2026-01-01T00:00:00Z" };
const token = await generateAccessToken(user);
const server = app.listen(0, "127.0.0.1");
before(async () => { if (!server.listening) await new Promise<void>(resolve => server.once("listening", resolve)); });
after(() => new Promise<void>(resolve => server.close(() => resolve())));
afterEach(() => {
  const remaining = steps.length; const errors = transportErrors;
  steps = []; transportErrors = [];
  assert.deepEqual(errors, [], "Database request assertions failed");
  assert.equal(remaining, 0, "Expected database requests were not made");
});
const call = (method: string, path = "", body?: unknown, bearer: string | null = token): Promise<{ status: number; body: any }> => new Promise((resolve, reject) => {
  const req = request({ hostname: "127.0.0.1", port: (server.address() as AddressInfo).port, method, agent: false,
    path: "/api/sanciones" + path, headers: { "Content-Type": "application/json", ...(bearer === null ? {} : { Authorization: "Bearer " + bearer }) } }, res => {
    let data = ""; res.setEncoding("utf8"); res.on("data", chunk => { data += chunk; });
    res.on("end", () => {
      try { resolve({ status: res.statusCode!, body: JSON.parse(data) }); }
      catch (error) { reject(error); }
    });
  });
  req.on("error", reject); req.setTimeout(60000, () => req.destroy(new Error("HTTP test timed out")));
  req.end(method === "GET" || body === undefined ? undefined : JSON.stringify(body));
});
const auth = (role = "SUPER_ADMIN"): Step[] => [
  { table: "usuarios", data: [{ ...user, id_rol: id, activo: true }] },
  { table: "roles", data: [{ codigo: role, activo: true }] },
];
const find = (data: unknown = [row]): Step => ({ table: "sanciones", data, check: url => {
  assert.equal(url.searchParams.get("id_sancion"), "eq." + id);
} });
const routes: [string, string][] = [["GET", ""], ["GET", "/" + id], ["POST", ""], ["PATCH", `/${id}/anular`]];

test("Validators normalize reasons, defaults and offset timestamps", () => {
  assert.equal(createSancionSchema.parse({ ...input, motivo: "  Inasistencia  " }).motivo, "Inasistencia");
  assert.deepEqual(anularSancionSchema.parse({ motivo_anulacion: "  Error de carga  " }), { motivo_anulacion: "Error de carga" });
  assert.deepEqual(sancionQuerySchema.parse({}), { page: 1, limit: 20 });
  assert.deepEqual(sancionQuerySchema.parse({ page: "2", limit: "100", vigente: "false" }), { page: 2, limit: 100, vigente: "false" });
  assert.ok(sancionIdSchema.safeParse({ id }).success);
});
for (const patch of [{ id_paciente: "bad" }, { id_especialidad: "bad" }, { id_turno: "bad" }, { motivo: "    " },
  { motivo: "1234" }, { motivo: "a".repeat(501) }, { fecha_fin: "2020-01-01T00:00:00Z" },
  { fecha_fin: "2099-01-01T10:00:00" }, { fecha_fin: "2099-02-30T00:00:00Z" }]) {
  test(`Creation validator rejects invalid ${Object.keys(patch)[0]}: ${JSON.stringify(patch).slice(0, 80)}`, () => {
    assert.equal(createSancionSchema.safeParse({ ...input, ...patch }).success, false);
  });
}
test("Validators reject missing inputs, invalid IDs, cancellation reasons and list filters", () => {
  assert.equal(createSancionSchema.safeParse({}).success, false);
  assert.equal(sancionIdSchema.safeParse({ id: "bad" }).success, false);
  for (const body of [{}, { motivo_anulacion: "1234" }, { motivo_anulacion: "a".repeat(501) }]) assert.equal(anularSancionSchema.safeParse(body).success, false);
  for (const query of [{ page: 0 }, { page: 1.5 }, { page: "abc" }, { limit: 0 }, { limit: 101 }, { vigente: "yes" },
    { id_paciente: "bad" }, { id_especialidad: "bad" }, { vigente: ["true", "false"] }]) assert.equal(sancionQuerySchema.safeParse(query).success, false);
});
test("Every sanctions route requires a valid token", async () => {
  for (const [method, path] of routes) for (const bearer of [null, "invalid-token"]) {
    assert.equal((await call(method, path, {}, bearer)).status, 401);
  }
});
test("Patient and professional roles cannot access any sanctions route", async () => {
  for (const role of ["PACIENTE", "PROFESIONAL"]) for (const [method, path] of routes) {
    queue(...auth(role)); assert.equal((await call(method, path, {})).status, 403);
  }
});
test("Inactive users cannot access sanctions", async () => {
  queue({ table: "usuarios", data: [{ ...user, activo: false }] });
  const result = await call("GET");
  assert.equal(result.status, 403);
  assert.equal(result.body.code, 'ACCOUNT_DISABLED');
});
test("Invalid HTTP inputs fail before sanctions database queries", async () => {
  for (const [method, path, body] of [["POST", "", {}], ["GET", "/bad", undefined], ["GET", "?limit=101", undefined],
    ["PATCH", `/${id}/anular`, { motivo_anulacion: "" }], ["PATCH", "/bad/anular", { motivo_anulacion: "Error de carga" }]] as [string, string, unknown][]) {
    queue(...auth()); const result = await call(method, path, body);
    assert.equal(result.status, 400); assert.equal(result.body.success, false); assert.ok(result.body.errors.length);
  }
});
for (const role of ["SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"]) {
  test(`${role} can create, list, read and cancel sanctions with authenticated audit fields`, async () => {
    queue(...auth(role), { table: "sanciones", method: "POST", data: row, check: (_, body) => {
      assert.deepEqual(body, { ...input, creado_por: id });
    } });
    const created = await call("POST", "", { ...input, creado_por: "forged", anulada: true, fecha_inicio: "2099-01-01T00:00:00Z" });
    assert.equal(created.status, 201); assert.equal(created.body.ok, true); assert.deepEqual(created.body.sancion, row);
    queue(...auth(role), { table: "sanciones", data: [row] });
    assert.deepEqual((await call("GET")).body, { ok: true, page: 1, limit: 20, total: 1, totalPages: 1, sanciones: [row] });
    queue(...auth(role), find());
    assert.deepEqual(await call("GET", "/" + id), { status: 200, body: { ok: true, sancion: row } });
    const cancelled = { ...row, anulada: true, motivo_anulacion: "Error de carga", anulada_por: id };
    queue(...auth(role), find(), { table: "sanciones", method: "PATCH", data: [cancelled], check: (url, body) => {
      assert.equal(url.searchParams.get("id_sancion"), "eq." + id);
      assert.equal(url.searchParams.get("anulada"), "eq.false");
      assert.deepEqual(body, { anulada: true, motivo_anulacion: "Error de carga", anulada_por: id });
    } });
    const result = await call("PATCH", `/${id}/anular`, { motivo_anulacion: "  Error de carga  ", anulada_por: "forged" });
    assert.equal(result.status, 200); assert.deepEqual(result.body.sancion, cancelled);
  });
}
test("List applies patient, specialty, exact count, ordering and pagination", async () => {
  queue(...auth(), { table: "sanciones", data: [row], total: 41, check: (url, _, headers) => {
    assert.equal(url.searchParams.get("id_paciente"), "eq." + id);
    assert.equal(url.searchParams.get("id_especialidad"), "eq." + id);
    assert.equal(url.searchParams.get("offset"), "20"); assert.equal(url.searchParams.get("limit"), "20");
    assert.equal(url.searchParams.get("order"), "fecha_creacion.desc");
    assert.ok(headers.get("prefer")?.includes("count=exact"));
    for (const key of ["anulada", "fecha_inicio", "fecha_fin", "or"]) assert.equal(url.searchParams.get(key), null);
  } });
  assert.deepEqual((await call("GET", `?page=2&id_paciente=${id}&id_especialidad=${id}`)).body,
    { ok: true, page: 2, limit: 20, total: 41, totalPages: 3, sanciones: [row] });
});
test("Current sanctions include their start and exclude their end using the same instant", async () => {
  const before = Date.now();
  queue(...auth(), { table: "sanciones", data: [], total: 0, check: url => {
    assert.equal(url.searchParams.get("anulada"), "eq.false");
    const start = url.searchParams.get("fecha_inicio")!;
    const end = url.searchParams.get("fecha_fin")!;
    assert.ok(start.startsWith("lte.")); assert.ok(end.startsWith("gt."));
    assert.equal(start.slice(4), end.slice(3));
    assert.ok(Date.parse(start.slice(4)) >= before && Date.parse(start.slice(4)) <= Date.now());
  } });
  assert.equal((await call("GET", "?vigente=true")).status, 200);
});
test("Non-current sanctions include cancelled, future and expired records", async () => {
  queue(...auth(), { table: "sanciones", data: [], total: 0, check: url => {
    const filter = url.searchParams.get("or")!;
    assert.match(filter, /^\(anulada\.eq\.true,fecha_inicio\.gt\.(.+),fecha_fin\.lte\.(.+)\)$/);
    const match = filter.match(/fecha_inicio\.gt\.(.+),fecha_fin\.lte\.(.+)\)/)!;
    assert.equal(match[1], match[2]);
  } });
  assert.equal((await call("GET", "?vigente=false")).status, 200);
});
test("Empty data and absent count use empty list defaults", async () => {
  queue(...auth(), { table: "sanciones", data: null, total: null });
  assert.deepEqual((await call("GET")).body, { ok: true, page: 1, limit: 20, total: 0, totalPages: 0, sanciones: [] });
});
test("Missing sanctions return 404 for reading and cancellation without writes", async () => {
  for (const method of ["GET", "PATCH"]) {
    queue(...auth(), find([]));
    const result = await call(method, `/${id}${method === "PATCH" ? "/anular" : ""}`, { motivo_anulacion: "Error de carga" });
    assert.equal(result.status, 404); assert.equal(result.body.message, "La sanción no existe");
  }
});
test("Already cancelled sanctions return 409 without writing", async () => {
  queue(...auth(), find([{ ...row, anulada: true }]));
  assert.equal((await call("PATCH", `/${id}/anular`, { motivo_anulacion: "Error de carga" })).status, 409);
});
test("Concurrent cancellation returns 409 when the conditional update changes no rows", async () => {
  queue(...auth(), find(), { table: "sanciones", method: "PATCH", data: [], check: url => assert.equal(url.searchParams.get("anulada"), "eq.false") });
  assert.equal((await call("PATCH", `/${id}/anular`, { motivo_anulacion: "Error de carga" })).status, 409);
});
for (const [code, status] of [["23505", 409], ["P0001", 400], ["23503", 400], ["23514", 400], ["XX000", 500]] as const) {
  test(`Creation maps database ${code} to HTTP ${status}`, async () => {
    queue(...auth(), { table: "sanciones", method: "POST", status: 400, data: { code, message: "Database validation" } });
    const result = await call("POST", "", input);
    assert.equal(result.status, status); assert.equal(result.body.success, false);
    if (code === "XX000") assert.equal(result.body.message, "No se pudo registrar la sanción");
  });
}
test("Read, list and cancellation failures return controlled 500 responses", async () => {
  const failure: Step = { table: "sanciones", status: 500, data: { code: "XX000", message: "private database details" } };
  for (const [method, path, queries, message] of [
    ["GET", "", [failure], "No se pudieron consultar las sanciones"],
    ["GET", "/" + id, [failure], "No se pudo consultar la sanción"],
    ["PATCH", `/${id}/anular`, [find(), { ...failure, method: "PATCH" }], "No se pudo anular la sanción"],
  ] as [string, string, Step[], string][]) {
    queue(...auth(), ...queries);
    assert.deepEqual(await call(method, path, { motivo_anulacion: "Error de carga" }), { status: 500, body: { success: false, message } });
  }
});
test("Service optional audit users are stored as null", async () => {
  queue({ table: "sanciones", method: "POST", data: row, check: (_, body) => assert.equal(body?.creado_por, null) });
  await registerSancion(input);
  queue(find(), { table: "sanciones", method: "PATCH", data: [{ ...row, anulada: true }], check: (_, body) => assert.equal(body?.anulada_por, null) });
  await cancelSancion(id, "Error de carga");
});
