import assert from "node:assert/strict";
import { before, after, afterEach, test } from "node:test";
import { queue, checked, auth, scope, config, curl, id, other, user, row, local } from "./configuracion-fixtures.js";
import { createConfiguracionSchema, updateConfiguracionSchema } from "../src/validators/configuracion.validator.js";
const { default: app } = await import("../src/app.js");
const { generateAccessToken } = await import("../src/services/jwt.service.js");
const { getConfiguracionValue } = await import("../src/services/configuracion.service.js");
const server = app.listen(0, "127.0.0.1");
before(async () => { if (!server.listening) await new Promise<void>(resolve => server.once("listening", resolve)); });
after(() => new Promise<void>(resolve => server.close(() => resolve())));
afterEach(checked);
const token = await generateAccessToken(user);
const call = (method = "GET", path = "", body?: unknown, authenticated = true) => curl(server, token, method, path, body, authenticated);

test("Especialidades de una SAPS se guardan sin profesional ni horario", async () => {
  const setting = { ...local, clave: "salita.especialidades", valor: [other] };
  queue(...auth(),
    { table: "especialidades", result: [{ id_especialidad: other }] },
    { table: "salitas", result: [{ id_salita: id, activo: true }] },
    config([]),
    { ...config(setting), method: "POST", check: (_url, body) => {
      assert.equal(body?.id_salita, id);
      assert.deepEqual(body?.valor, [other]);
      assert.equal(body?.actualizado_por, id);
    } });
  const result = await call("POST", "", {
    id_salita: id, clave: "salita.especialidades", valor: [other], es_publica: false,
  });
  assert.equal(result.status, 201);
});

test("Especialidades por SAPS rechaza configuración global, duplicados e IDs inexistentes", async () => {
  for (const body of [
    { clave: "salita.especialidades", valor: [other] },
    { id_salita: id, clave: "salita.especialidades", valor: [other, other] },
  ]) {
    queue(...auth());
    assert.equal((await call("POST", "", body)).status, 400);
    checked();
  }
  queue(...auth(), { table: "especialidades", result: [] });
  assert.equal((await call("POST", "", {
    id_salita: id, clave: "salita.especialidades", valor: [other],
  })).status, 400);
});

test("Actualizar especialidades de SAPS permite quitar todas y conserva la sala", async () => {
  const setting = { ...local, clave: "salita.especialidades", valor: [other] };
  queue(...auth(), config([setting]),
    { ...config([{ ...setting, valor: [] }]), method: "PATCH", check: (url, body) => {
      assert.equal(url.searchParams.get("id_salita"), `eq.${id}`);
      assert.deepEqual(body?.valor, []);
    } });
  assert.equal((await call("PATCH", `/${id}`, { valor: [] })).status, 200);
});

test("GET: SUPER_ADMIN lista, filtra global/salita y busca por clave", async () => {
  for (const path of ["", "?scope=global", `?id_salita=${id}`, "/turnos.dias_anticipacion", `/agenda.intervalo_default?id_salita=${id}`]) {
    queue(...auth(), { ...config(), check: url => {
      if (path.includes("global") || path === "/turnos.dias_anticipacion") assert.equal(url.searchParams.get("id_salita"), "is.null");
      if (path.includes("id_salita=")) assert.equal(url.searchParams.get("id_salita"), "eq." + id);
      if (path.startsWith("/")) assert.ok(url.searchParams.has("clave"));
    } });
    assert.equal((await call("GET", path)).status, 200);
  }
});
test("GET pública: sin JWT, solo claves seguras y sin auditoría ni secretos", async () => {
  queue({ ...config([row, { ...row, clave: "smtp.password", valor: "secret" }, { ...row, valor: { token: "secret" } }]), check: url => assert.equal(url.searchParams.get("es_publica"), "eq.true") });
  const result = await call("GET", "/publica", undefined, false);
  assert.equal(result.status, 200); assert.equal(result.json.total, 1);
  assert.equal(result.json.configuraciones[0].valor, 30);
  assert.equal(result.json.configuraciones[0].actualizado_por, undefined);
  assert.equal(result.json.configuraciones[0].descripcion, undefined);
  assert.ok(!JSON.stringify(result.json).includes("secret"));
});
test("POST global y local: auditoría autenticada, sin duplicados", async () => {
  for (const idSalita of [undefined, id]) {
    const input = { clave: "agenda.intervalo_default", valor: 20, ...(idSalita ? { id_salita: idSalita } : {}) };
    queue(...auth(), ...(idSalita ? [{ table: "salitas", result: [{ id_salita: id }] }] : []),
      { ...config([]), check: url => assert.equal(url.searchParams.get("id_salita"), idSalita ? "eq." + id : "is.null") },
      { ...config(local), method: "POST", check: (_, body) => {
        assert.equal(body?.actualizado_por, id); assert.equal(body?.es_publica, false);
        assert.equal(body?.id_salita, idSalita ?? null); assert.equal(body?.fecha_actualizacion, undefined);
      } });
    assert.equal((await call("POST", "", input)).status, 201);
  }
});
test("POST duplicado previo y carrera SQL devuelven 409", async () => {
  queue(...auth(), config()); assert.equal((await call("POST", "", { clave: row.clave, valor: 30 })).status, 409);
  queue(...auth(), config([]), { ...config({ code: "23505", message: "unique" }), method: "POST", status: 409 });
  const result = await call("POST", "", { clave: row.clave, valor: 30 });
  assert.equal(result.status, 409); assert.equal(result.json.message, "Ya existe una configuración con esa clave");
});
test("PATCH conserva visibilidad y solo escribe campos permitidos", async () => {
  queue(...auth(), config(), { ...config([{ ...row, valor: 0 }]), method: "PATCH", check: (_, body) =>
    assert.deepEqual(body, { valor: 0, actualizado_por: id }) });
  const result = await call("PATCH", "/" + id, { valor: 0 });
  assert.equal(result.status, 200);
});
test("ADMIN_SALITA modifica las cinco claves permitidas de su salita", async () => {
  for (const clave of ["agenda.intervalo_default", "notificaciones.recordatorio_horas", "turnos.dias_anticipacion", "turnos.cancelacion_horas", "sanciones.duracion_dias"]) {
    queue(...auth("ADMIN_SALITA"), config([{ ...local, clave }]), scope,
      { ...config([{ ...local, clave, valor: 15 }]), method: "PATCH", check: (url, body) => {
        assert.equal(url.searchParams.get("id_salita"), "eq." + id);
        assert.deepEqual(body, { valor: 15, actualizado_por: id });
      } });
    assert.equal((await call("PATCH", "/" + id, { valor: 15 })).status, 200);
  }
});
test("ADMIN_SALITA: deniega otra salita, global, claves internas y visibilidad", async () => {
  queue(...auth("ADMIN_SALITA"), config([{ ...local, id_salita: other }]), scope);
  assert.equal((await call("PATCH", "/" + id, { valor: 15 })).status, 403);
  for (const current of [row, { ...local, clave: "sistema.nombre" }]) {
    queue(...auth("ADMIN_SALITA"), config([current]));
    assert.equal((await call("PATCH", "/" + id, { valor: 15 })).status, 403);
  }
  queue(...auth("ADMIN_SALITA"), config([local]), scope);
  assert.equal((await call("PATCH", "/" + id, { es_publica: true })).status, 403);
  queue(...auth("ADMIN_SALITA"), scope);
  assert.equal((await call("GET", `?id_salita=${other}`)).status, 403);
});
test("ADMIN_SALITA lista solo globales públicas y sus asignaciones", async () => {
  queue(...auth("ADMIN_SALITA"), scope, { ...config([row, local]), check: url => {
    assert.equal(url.searchParams.get("or"), `(and(id_salita.is.null,es_publica.eq.true),id_salita.in.(${id}))`);
  } });
  assert.equal((await call()).json.total, 2);
});
test("Roles de lectura solo consultan públicas y no escriben", async () => {
  for (const role of ["RECEPCION", "PACIENTE", "PROFESIONAL"]) {
    queue(...auth(role), { ...config(), check: url => assert.equal(url.searchParams.get("es_publica"), "eq.true") });
    assert.equal((await call()).status, 200);
    for (const method of ["POST", "PATCH"]) {
      queue(...auth(role)); assert.equal((await call(method, method === "PATCH" ? "/" + id : "", { valor: 5 })).status, 403);
    }
  }
  assert.equal((await call("POST", "", {}, false)).status, 401);
});
test("Validación JSON y PATCH: rechaza campos inmutables, null raíz y datos inválidos", async () => {
  for (const valor of [30, false, "SAPS", { dias: 15, activo: true, extra: null }, [1, "a"]])
    assert.ok(createConfiguracionSchema.safeParse({ clave: "sistema.test", valor }).success);
  assert.deepEqual(updateConfiguracionSchema.parse({ valor: 0 }), { valor: 0 });
  for (const body of [{}, { clave: "otra" }, { id_salita: other }, { actualizado_por: other }, { valor: null }, { es_publica: "false" }]) {
    queue(...auth()); assert.equal((await call("PATCH", "/" + id, body)).status, 400);
  }
  queue(...auth()); assert.equal((await call("PATCH", "/bad", { valor: 1 })).status, 400);
  queue(...auth()); assert.equal((await call("POST", "", { clave: "Clave mala", valor: 1 })).status, 400);
  queue(...auth()); assert.equal((await call("POST", "", { clave: "smtp.password", valor: "secret", es_publica: true })).status, 400);
});
test("404 para salita/configuración inexistentes y 500 para fallo de DB", async () => {
  queue(...auth(), { table: "salitas", result: [] });
  assert.equal((await call("POST", "", { clave: "agenda.intervalo_default", valor: 20, id_salita: id })).status, 404);
  queue(...auth(), config([])); assert.equal((await call("PATCH", "/" + id, { valor: 1 })).status, 404);
  queue(...auth(), config([])); assert.equal((await call("GET", "/inexistente")).status, 404);
  queue(...auth(), { ...config({ code: "XX000", message: "private" }), status: 400 });
  const failure = await call(); assert.equal(failure.status, 500); assert.ok(!JSON.stringify(failure.json).includes("private"));
});
test("Resolución: local, global, default y valores falsy sin pérdida", async () => {
  queue(config([{ ...local, valor: 30 }])); assert.equal(await getConfiguracionValue(local.clave, id, 20), 30);
  queue(config([]), config([{ ...row, valor: 20 }])); assert.equal(await getConfiguracionValue(local.clave, other, 10), 20);
  queue(config([]), config([])); assert.equal(await getConfiguracionValue(local.clave, other, 10), 10);
  for (const valor of [0, false, ""]) {
    queue(config([{ ...local, valor }])); assert.equal(await getConfiguracionValue(local.clave, id, 20), valor);
  }
  queue(config([])); assert.equal(await getConfiguracionValue("inexistente"), undefined);
});
