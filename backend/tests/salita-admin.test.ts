import assert from "node:assert/strict";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { before, after, afterEach, test } from "node:test";
import { queue, drained } from "./patient-fixtures.js";

const { default: app } = await import("../src/app.js");
const { generateAccessToken } = await import("../src/services/jwt.service.js");

const id = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const user = { id_usuario: id, email: "test@example.com", nombre_usuario: "test", rol: "SUPER_ADMIN" };
const rows = [
  { id_salita: id, codigo: "NORTE", nombre: "SAPS Norte", activo: true },
  { id_salita: other, codigo: "SUR", nombre: "SAPS Sur", activo: true },
];

const token = await generateAccessToken(user);
const server = app.listen(0, "127.0.0.1");

before(async () => {
  if (!server.listening) {
    await new Promise<void>(resolve => server.once("listening", resolve));
  }
});

after(() => new Promise<void>(resolve => server.close(() => resolve())));
afterEach(drained);

const auth = (role = "SUPER_ADMIN") => [
  { table: "usuarios", result: [{ ...user, id_rol: id, activo: true }] },
  { table: "roles", result: [{ codigo: role, activo: true }] },
];

const call = (): Promise<{ status: number; json: any }> => new Promise((resolve, reject) => {
  const req = request({
    hostname: "127.0.0.1",
    port: (server.address() as AddressInfo).port,
    path: "/api/salitas/admin",
    method: "GET",
    headers: { Authorization: "Bearer " + token },
  }, res => {
    let body = "";
    res.setEncoding("utf8");
    res.on("data", chunk => { body += chunk; });
    res.on("end", () => resolve({ status: res.statusCode!, json: JSON.parse(body) }));
  });
  req.on("error", reject);
  req.end();
});

test("SUPER_ADMIN consulta todas las salitas administrativas", async () => {
  queue(...auth(), { table: "salitas", result: rows });

  const result = await call();

  assert.equal(result.status, 200);
  assert.deepEqual(result.json.data, rows);
});

test("ADMIN_SALITA consulta solo sus salitas vigentes", async () => {
  queue(
    ...auth("ADMIN_SALITA"),
    { table: "usuario_salita", result: [{ id_salita: id }], check: url => {
      assert.equal(url.searchParams.get("id_usuario"), "eq." + id);
      assert.equal(url.searchParams.get("activo"), "eq.true");
      assert.ok(url.searchParams.has("fecha_desde"));
      assert.ok(url.searchParams.has("or"));
    } },
    { table: "salitas", result: [rows[0]], check: url => {
      assert.equal(url.searchParams.get("id_salita"), `in.(${id})`);
    } },
  );

  const result = await call();

  assert.equal(result.status, 200);
  assert.deepEqual(result.json.data, [rows[0]]);
});
