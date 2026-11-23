import assert from "node:assert/strict";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { before, after, afterEach, test } from "node:test";
import { queue, drained, id, user, turno, state, input, horario, entities, freeSlot } from "./turno-fixtures.js";
const { default: app } = await import("../src/app.js");
const { generateAccessToken } = await import("../src/services/jwt.service.js");
const token = await generateAccessToken(user);
const server = app.listen(0, "127.0.0.1");
before(async () => { if (!server.listening) await new Promise<void>(resolve => server.once("listening", resolve)); });
after(() => new Promise<void>(resolve => server.close(() => resolve())));
afterEach(drained);

// HTTP real contra Express, con transporte de Supabase interceptado por los fixtures.
const call = (method: string, path: string, body?: unknown): Promise<number> => new Promise((resolve, reject) => {
  const req = request({ hostname: "127.0.0.1", port: (server.address() as AddressInfo).port,
    path: "/api/turnos" + path, method,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" } }, res => {
    res.resume(); res.on("end", () => resolve(res.statusCode!));
  });
  req.on("error", reject); req.end(body === undefined ? undefined : JSON.stringify(body));
});
const auth = (role = "SUPER_ADMIN") => [
  { table: "usuarios", result: [{ ...user, id_rol: id, activo: true }] },
  { table: "roles", result: [{ codigo: role, activo: true }] }
];

test("Turnos devuelve 403 a PACIENTE y PROFESIONAL aunque el JWT declare SUPER_ADMIN", async () => {
  for (const role of ["PACIENTE", "PROFESIONAL"]) {
    queue(...auth(role));
    assert.equal(await call("POST", "", input), 403);
  }
});
test("POST integrado devuelve 201 y GET por ID devuelve 200", async () => {
  queue(...auth(), { table: "estados_turno", result: [state] }, ...entities(),
    { table: "horarios_atencion", result: [horario] }, ...freeSlot(),
    { table: "turnos", method: "POST", result: turno });
  assert.equal(await call("POST", "", input), 201);
  queue(...auth(), { table: "turnos", result: [turno] });
  assert.equal(await call("GET", "/" + id), 200);
});
test("POST con horario inválido responde 400 y con bloqueo responde 409", async () => {
  queue(...auth(), { table: "estados_turno", result: [state] }, ...entities(),
    { table: "horarios_atencion", result: [] });
  assert.equal(await call("POST", "", input), 400);
  queue(...auth(), { table: "estados_turno", result: [state] }, ...entities(),
    { table: "horarios_atencion", result: [horario] }, { table: "bloqueos_agenda", result: [{ id_bloqueo: id }] });
  assert.equal(await call("POST", "", input), 409);
});
test("PATCH reprograma con 200 o rechaza bloqueo con 409 sin escribir", async () => {
  const change = { fecha_hora_inicio: "2099-10-05T10:20:00-03:00" };
  queue(...auth(), { table: "turnos", result: [turno] }, ...entities(),
    { table: "horarios_atencion", result: [horario] }, ...freeSlot(),
    { table: "turnos", method: "PATCH", result: [{ ...turno, ...change }] });
  assert.equal(await call("PATCH", "/" + id, change), 200);
  queue(...auth(), { table: "turnos", result: [turno] }, ...entities(),
    { table: "horarios_atencion", result: [horario] }, { table: "bloqueos_agenda", result: [{ id_bloqueo: id }] });
  assert.equal(await call("PATCH", "/" + id, change), 409);
});
