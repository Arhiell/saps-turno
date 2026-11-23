import assert from "node:assert/strict";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { after, afterEach, before, test } from "node:test";
import { id, user } from "./turno-fixtures.js";
import { historialTurnoParamsSchema, historialTurnoQuerySchema } from "../src/validators/historial-turno.validator.js";

type Step = { table: string; data: unknown; status?: number; total?: number | null; check?: (url: URL, options: RequestInit | undefined) => void };
let steps: Step[] = [];
let transportErrors: unknown[] = [];
const queue = (...next: Step[]) => { assert.equal(steps.length, 0); steps.push(...next); };
// Exercise the real Supabase client while keeping all database traffic in process.
globalThis.fetch = async (input, options) => {
  try {
    const url = new URL(String(input));
    const step = steps.shift();
    assert.ok(step, "Unexpected database request: " + url);
    assert.equal(url.hostname, "supabase.invalid");
    assert.equal(url.pathname, "/rest/v1/" + step.table);
    assert.equal(options?.method ?? "GET", "GET");
    step.check?.(url, options);
    return new Response(JSON.stringify(step.data), {
      status: step.status ?? 200,
      headers: { "Content-Type": "application/json", ...(step.total === null ? {} : { "Content-Range": `0-0/${step.total ?? 1}` }) },
    });
  } catch (error) { transportErrors.push(error); throw error; }
};
const { default: app } = await import("../src/app.js");
const { generateAccessToken } = await import("../src/services/jwt.service.js");
const { getHistorialGeneral, getHistorialByTurno } = await import("../src/services/historial-turno.service.js");
const token = await generateAccessToken(user);
const server = app.listen(0, "127.0.0.1");
before(async () => { if (!server.listening) await new Promise<void>(resolve => server.once("listening", resolve)); });
after(() => new Promise<void>(resolve => server.close(() => resolve())));
afterEach(() => {
  const remaining = steps.length;
  const errors = transportErrors;
  steps = []; transportErrors = [];
  assert.deepEqual(errors, [], "Database request assertions failed");
  assert.equal(remaining, 0, "Expected database requests were not made");
});
const call = (path: string, bearer: string | null = token): Promise<{ status: number; body: any }> => new Promise((resolve, reject) => {
  const req = request({ hostname: "127.0.0.1", port: (server.address() as AddressInfo).port,
    path: "/api" + path, headers: bearer === null ? {} : { Authorization: "Bearer " + bearer } }, res => {
    let body = "";
    res.setEncoding("utf8"); res.on("data", chunk => { body += chunk; });
    res.on("end", () => resolve({ status: res.statusCode!, body: JSON.parse(body) }));
  });
  req.on("error", reject); req.end();
});
const auth = (role = "SUPER_ADMIN"): Step[] => [
  { table: "usuarios", data: [{ ...user, id_rol: id, activo: true }] },
  { table: "roles", data: [{ codigo: role, activo: true }] },
];
const exists: Step = { table: "turnos", data: [{ id_turno: id, id_salita: id }], check: url => {
  assert.equal(url.searchParams.get("id_turno"), "eq." + id);
  assert.equal(url.searchParams.get("select"), "id_turno,id_salita");
} };
const history = [{ id_historial: id, id_turno: id, accion: "CREACION", fecha: "2026-09-20T13:00:00Z",
  usuario: { id_usuario: id, nombre_usuario: "test", email: user.email }, estado_anterior: null,
  estado_nuevo: { id_estado: id, codigo: "SOLICITADO", nombre: "Solicitado" },
  fecha_hora_anterior: null, fecha_hora_nueva: "2026-09-21T13:00:00Z", detalle: "Turno creado" }];
const paths = ["/historial-turnos", `/turnos/${id}/historial`];

test("Validators normalize defaults, pagination, UUIDs and action whitespace", () => {
  assert.deepEqual(historialTurnoQuerySchema.parse({}), { page: 1, limit: 20 });
  assert.deepEqual(historialTurnoParamsSchema.parse({ idTurno: id }), { idTurno: id });
  assert.deepEqual(historialTurnoQuerySchema.parse({ accion: " CREACION ", page: "2", limit: "100" }), { accion: "CREACION", page: 2, limit: 100 });
  assert.ok(historialTurnoQuerySchema.safeParse({ fecha_desde: "2024-02-29", fecha_hasta: "2024-02-29" }).success);
});

for (const query of [{ page: 0 }, { page: -1 }, { page: 1.5 }, { page: "abc" }, { page: "Infinity" },
  { limit: 0 }, { limit: 101 }, { limit: 1.5 }, { accion: " " }, { accion: ["CREACION"] },
  { id_usuario: "invalid" }, { fecha_desde: "2026-02-30" }, { fecha_hasta: "20/09/2026" },
  { fecha_desde: "2026-09-21", fecha_hasta: "2026-09-20" }]) {
  test(`Validator rejects ${JSON.stringify(query)}`, () => assert.equal(historialTurnoQuerySchema.safeParse(query).success, false));
}

test("Both routes require valid authentication", async () => {
  for (const path of paths) for (const bearer of [null, "invalid-token"]) {
    assert.equal((await call(path, bearer)).status, 401);
  }
});
test("Both routes reject patient and professional database roles despite admin JWT", async () => {
  for (const path of paths) for (const role of ["PACIENTE", "PROFESIONAL"]) {
    queue(...auth(role)); assert.equal((await call(path)).status, 403);
  }
});
test("Inactive users cannot read history", async () => {
  for (const path of paths) {
    queue({ table: "usuarios", data: [{ ...user, activo: false }] });
    assert.equal((await call(path)).status, 401);
  }
});
test("HTTP validation rejects malformed parameters before querying history", async () => {
  for (const path of ["/turnos/invalid/historial", "/historial-turnos?page=0", "/historial-turnos?limit=101",
    "/historial-turnos?id_usuario=invalid", "/historial-turnos?fecha_desde=2026-09-21&fecha_hasta=2026-09-20"]) {
    queue(...auth()); const result = await call(path);
    assert.equal(result.status, 400); assert.equal(result.body.success, false); assert.ok(result.body.errors.length);
  }
});
test("Specific history returns joined data and descending dates", async () => {
  queue(...auth(), exists, { table: "historial_turnos", data: history, check: url => {
    assert.equal(url.searchParams.get("id_turno"), "eq." + id);
    assert.equal(url.searchParams.get("order"), "fecha.desc");
    for (const fk of ["id_usuario", "id_estado_anterior", "id_estado_nuevo"]) assert.ok(url.searchParams.get("select")?.includes(`historial_turnos_${fk}_fkey`));
  } });
  assert.deepEqual(await call(paths[1]!), { status: 200, body: { ok: true, idTurno: id, total: 1, historial: history } });
});
test("Missing appointment returns 404 without reading history", async () => {
  queue(...auth(), { table: "turnos", data: [] });
  const result = await call(paths[1]!);
  assert.equal(result.status, 404); assert.equal(result.body.message, "El turno solicitado no existe");
});
test("Existing appointment with no events returns an empty history", async () => {
  queue(...auth(), exists, { table: "historial_turnos", data: null });
  assert.deepEqual((await call(paths[1]!)).body, { ok: true, idTurno: id, total: 0, historial: [] });
});
test("General history applies every filter and exact pagination using Argentine day boundaries", async () => {
  queue(...auth(), { table: "historial_turnos", data: history, total: 41, check: (url, options) => {
    assert.equal(url.searchParams.get("accion"), "eq.CREACION");
    assert.equal(url.searchParams.get("id_usuario"), "eq." + id);
    assert.deepEqual(url.searchParams.getAll("fecha"), ["gte.2026-09-20T03:00:00.000Z", "lt.2026-09-21T03:00:00.000Z"]);
    assert.equal(url.searchParams.get("offset"), "20"); assert.equal(url.searchParams.get("limit"), "20");
    assert.equal(url.searchParams.get("order"), "fecha.desc");
    assert.ok(new Headers(options?.headers).get("prefer")?.includes("count=exact"));
    assert.equal(url.searchParams.get("turno.id_salita"), null);
  } });
  assert.deepEqual(await call(`/historial-turnos?page=2&accion=CREACION&id_usuario=${id}&fecha_desde=2026-09-20&fecha_hasta=2026-09-20`),
    { status: 200, body: { ok: true, page: 2, limit: 20, total: 41, totalPages: 3, historial: history } });
});
test("General history defaults and absent count produce a consistent empty response", async () => {
  queue(...auth(), { table: "historial_turnos", data: null, total: null, check: url => {
    assert.equal(url.searchParams.get("offset"), "0"); assert.equal(url.searchParams.get("limit"), "20");
    for (const filter of ["accion", "id_usuario", "fecha"]) assert.equal(url.searchParams.get(filter), null);
  } });
  assert.deepEqual((await call(paths[0]!)).body, { ok: true, page: 1, limit: 20, total: 0, totalPages: 0, historial: [] });
});
for (const role of ["ADMIN_SALITA", "RECEPCION"]) {
  test(`${role} can read history only within assigned clinics`, async () => {
    queue(...auth(role), { table: "usuario_salita", data: [{ id_salita: id }] }, exists,
      { table: "historial_turnos", data: history });
    assert.equal((await call(paths[1]!)).status, 200);
    queue(...auth(role), { table: "usuario_salita", data: [] }, exists);
    assert.equal((await call(paths[1]!)).status, 403);
    queue(...auth(role), { table: "usuario_salita", data: [{ id_salita: "22222222-2222-4222-8222-222222222222" }] }, exists);
    assert.equal((await call(paths[1]!)).status, 403);
  });
  test(`${role} list filters clinics before counting and paginating`, async () => {
    queue(...auth(role), { table: "usuario_salita", data: [{ id_salita: id }] },
      { table: "historial_turnos", data: history, check: url => {
        assert.ok(url.searchParams.get("select")?.includes("turno:turnos!inner(id_salita)"));
        assert.equal(url.searchParams.get("turno.id_salita"), `in.(${id})`);
      } });
    assert.equal((await call(paths[0]!)).status, 200);
    queue(...auth(role), { table: "usuario_salita", data: [] });
    assert.deepEqual((await call(paths[0]!)).body, { ok: true, page: 1, limit: 20, total: 0, totalPages: 0, historial: [] });
  });
}
test("Database failures return controlled 500 errors without exposing details", async () => {
  const failure = { code: "XX000", message: "private database details" };
  for (const [path, queries, message] of [
    [paths[1]!, [{ table: "turnos", data: failure, status: 500 }], "No se pudo verificar el turno"],
    [paths[1]!, [exists, { table: "historial_turnos", data: failure, status: 500 }], "No se pudo consultar el historial del turno"],
    [paths[0]!, [{ table: "historial_turnos", data: failure, status: 500 }], "No se pudo consultar el historial general"],
  ] as [string, Step[], string][]) {
    queue(...auth(), ...queries);
    assert.deepEqual(await call(path), { status: 500, body: { success: false, message } });
  }
});
test("Services enforce roles even when called without HTTP middleware", async () => {
  for (const operation of [() => getHistorialByTurno(id, { ...user, rol: "PACIENTE" }),
    () => getHistorialGeneral({ page: 1, limit: 20 }, { ...user, rol: "PROFESIONAL" })]) {
    await assert.rejects(operation(), { statusCode: 403 });
  }
});
