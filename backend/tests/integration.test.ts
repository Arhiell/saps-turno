import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { queue, drained } from "./patient-fixtures.js";
import { createBloqueoAgendaSchema } from "../src/validators/bloqueo-agenda.validator.js";
const { default: app } = await import("../src/app.js");
const { generateAccessToken } = await import("../src/services/jwt.service.js");
const { crearHorario, actualizarHorario } = await import("../src/services/horario-atencion.service.js");
const { actualizarBloqueo } = await import("../src/services/bloqueo-agenda.service.js");
const server = app.listen(0, "127.0.0.1");
before(async () => { if (!server.listening) await new Promise<void>(resolve => server.once("listening", resolve)); });
after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
afterEach(drained);
const id = "11111111-1111-4111-8111-111111111111";
const call = (path: string, method = "GET", token?: string): Promise<number> => new Promise((resolve, reject) => {
  const req = request({ hostname: "127.0.0.1", port: (server.address() as AddressInfo).port,
    path: "/api" + path, method, headers: token ? { Authorization: "Bearer " + token } : {} }, res => {
    res.resume(); res.on("end", () => resolve(res.statusCode!));
  });
  req.on("error", reject); req.end();
});
const auth = async (role: string) => {
  queue({ table: "usuarios", result: [{ id_usuario: id, id_rol: id, activo: true }] },
    { table: "roles", result: [{ codigo: role, activo: true }] });
  return generateAccessToken({ id_usuario: id, email: "test@example.com", nombre_usuario: "test", rol: role });
};
test("Agenda rechaza lecturas y escrituras sin token antes de consultar la base", async () => {
  for (const prefix of ["/horarios-atencion", "/bloqueos-agenda"]) {
    for (const method of ["GET", "POST", "PUT", "DELETE"]) {
      assert.equal(await call(prefix + (["PUT", "DELETE"].includes(method) ? "/" + id : ""), method), 401);
    }
  }
});
test("Agenda rechaza roles no operativos", async () => {
  for (const prefix of ["/horarios-atencion", "/bloqueos-agenda"]) {
    assert.equal(await call(prefix, "POST", await auth("PACIENTE")), 403);
  }
});
test("Agenda permite consultar a los tres roles operativos", async () => {
  for (const role of ["SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"]) {
    for (const [path, table] of [["/horarios-atencion", "horarios_atencion"], ["/bloqueos-agenda", "bloqueos_agenda"]]) {
      const token = await generateAccessToken({ id_usuario: id, email: "test@example.com", nombre_usuario: "test", rol: role });
      queue({ table: "usuarios", result: [{ id_usuario: id, id_rol: id, activo: true }] },
        { table: "roles", result: [{ codigo: role, activo: true }] }, { table: table!, result: [] });
      assert.equal(await call(path!, "GET", token), 200);
    }
  }
});
test("Relaciones requieren token y no interceptan otras rutas ni el 404", async () => {
  for (const [method, path] of [["GET", "/patients/" + id + "/tutors"], ["POST", "/patients/" + id + "/tutors"],
    ["PATCH", "/patients/" + id + "/tutors/" + id], ["PATCH", "/patients/" + id + "/tutors/" + id + "/end"],
    ["GET", "/tutors/" + id + "/patients"]]) assert.equal(await call(path!, method!), 401);
  queue({ table: "profesionales", result: [] });
  assert.equal(await call("/profesionales"), 200);
  assert.equal(await call("/ruta-inexistente"), 404);
});
test("Bloqueos rechazan horas equivalentes en ambos formatos y aceptan segundos posteriores", () => {
  const base = { id_salita: id, fecha: "2026-09-20", motivo: "test" };
  for (const [start, end] of [["09:00", "09:00:00"], ["09:00:00", "09:00"]]) {
    assert.equal(createBloqueoAgendaSchema.safeParse({ ...base, hora_inicio: start, hora_fin: end }).success, false);
  }
  assert.equal(createBloqueoAgendaSchema.safeParse({ ...base, hora_inicio: "09:00", hora_fin: "09:00:01" }).success, true);
});
test("Alta de horario rechaza horas equivalentes sin escribir", async () => {
  await assert.rejects(crearHorario({ id_profesional: id, id_especialidad: id, id_salita: id,
    dia_semana: 1, hora_inicio: "09:00", hora_fin: "09:00:00" }), /hora de inicio/);
});
test("Actualizaciones comparan horas del request con TIME de la base", async () => {
  queue({ table: "horarios_atencion", result: [{ hora_inicio: "08:00:00", hora_fin: "09:00:00" }] });
  await assert.rejects(actualizarHorario(id, { hora_inicio: "09:00" }), /hora de inicio/);
  queue({ table: "bloqueos_agenda", result: [{ dia_completo: false, hora_inicio: "08:00:00", hora_fin: "09:00:00" }] });
  await assert.rejects(actualizarBloqueo(id, { hora_inicio: "09:00" }), /hora de inicio/);
});
