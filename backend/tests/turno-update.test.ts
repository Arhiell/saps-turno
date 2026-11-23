import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { queue, drained, input, horario, entities, freeSlot, id, user, state, turno } from "./turno-fixtures.js";
const { createTurno } = await import("../src/services/turno.service.js");
const { updateTurno, changeTurnoStatus } = await import("../src/services/turno-update.service.js");
const { getTurnos, getTurno } = await import("../src/services/turno-read.service.js");
const { rethrowTurnoError } = await import("../src/utils/turno-error.js");
afterEach(drained);

test("Alta calcula datos de servidor y conserva la reserva atómica de PostgreSQL", async () => {
  queue({ table: "estados_turno", result: [state] }, ...entities(),
    { table: "horarios_atencion", result: [horario] }, ...freeSlot(),
    { table: "turnos", method: "POST", result: turno, check: (_, body) => {
      assert.equal(body?.id_estado, state.id_estado);
      assert.equal(body?.creado_por, user.id_usuario);
      assert.equal(body?.fecha_hora_fin, "2099-10-05T13:20:00.000Z");
      assert.ok(String(body?.codigo_turno).length <= 30);
      assert.equal(body?.ocupa_agenda, undefined);
      assert.equal(body?.version, undefined);
    } });
  assert.equal((await createTurno(input, user)).id_turno, id);
});
test("Una reserva concurrente rechazada por exclusión devuelve 409", async () => {
  queue({ table: "estados_turno", result: [state] }, ...entities(),
    { table: "horarios_atencion", result: [horario] }, ...freeSlot(),
    { table: "turnos", method: "POST", status: 409,
      result: { code: "23P01", message: "ex_turnos_profesional_solapados" } });
  await assert.rejects(createTurno(input, user), { statusCode: 409 });
});
test("Reprogramación excluye al mismo turno y usa versión sin sobrescribir otro cambio", async () => {
  const agenda = freeSlot().map(step => step.table === "turnos"
    ? { ...step, check: (url: URL) => assert.equal(url.searchParams.get("id_turno"), "neq." + id) } : step);
  queue({ table: "turnos", result: [turno] }, ...entities(),
    { table: "horarios_atencion", result: [horario] }, ...agenda,
    { table: "turnos", method: "PATCH", result: [], check: (url, body) => {
      assert.equal(url.searchParams.get("version"), "eq.1");
      assert.equal(body?.fecha_hora_fin, "2099-10-05T13:40:00.000Z");
    } });
  await assert.rejects(updateTurno(id, { fecha_hora_inicio: "2099-10-05T10:20:00-03:00" }, user), { statusCode: 409 });
});
test("Cancelación conserva fechas y relaciones, sin DELETE ni consultas de disponibilidad", async () => {
  const cancelled = { ...state, id_estado: "22222222-2222-4222-8222-222222222222", codigo: "CANCELADO",
    ocupa_agenda: false, impide_otro_misma_especialidad: false, es_estado_final: true };
  queue({ table: "turnos", result: [turno] }, { table: "estados_turno", result: [cancelled] },
    { table: "turnos", method: "PATCH", result: [{ ...turno, estado: cancelled }], check: (_, body) => {
      assert.equal(body?.cancelado_por, id);
      assert.equal(body?.motivo_cancelacion, "Prueba");
      assert.ok(body?.fecha_cancelacion);
      assert.equal(body?.id_paciente, undefined);
      assert.equal(body?.fecha_hora_inicio, undefined);
      assert.equal(body?.ocupa_agenda, undefined);
    } });
  await changeTurnoStatus(id, { estado: "CANCELADO", motivo_cancelacion: "Prueba" }, user);
});
test("No reabre ni reprograma estados finales", async () => {
  for (const operation of [() => changeTurnoStatus(id, { estado: "SOLICITADO" }, user),
    () => updateTurno(id, { observaciones: "Cambio" }, user)]) {
    queue({ table: "turnos", result: [{ ...turno, estado: { ...state, es_estado_final: true } }] });
    await assert.rejects(operation(), { statusCode: 409 });
  }
});
test("Scope administrativo filtra en SQL y rechaza lectura de otra salita", async () => {
  const admin = { ...user, rol: "ADMIN_SALITA" };
  queue({ table: "usuario_salita", result: [{ id_salita: id }] },
    { table: "turnos", result: [], check: url => {
      assert.equal(url.searchParams.get("id_salita"), "in.(" + id + ")");
      assert.equal(url.searchParams.get("offset"), "20");
      assert.equal(url.searchParams.get("limit"), "20");
    } });
  await getTurnos({ page: 2, limit: 20 }, admin);
  queue({ table: "usuario_salita", result: [] }, { table: "turnos", result: [turno] });
  await assert.rejects(getTurno(id, admin), { statusCode: 403 });
  queue({ table: "usuario_salita", result: [] });
  assert.deepEqual((await getTurnos({ page: 1, limit: 20 }, admin)).turnos, []);
});
test("Los filtros de estado y fecha se resuelven con catálogo y día argentino", async () => {
  queue({ table: "estados_turno", result: [state] }, { table: "turnos", result: [], check: url => {
    assert.equal(url.searchParams.get("id_estado"), "eq." + id);
    assert.deepEqual(url.searchParams.getAll("fecha_hora_inicio"), ["gte.2026-10-05T03:00:00.000Z", "lt.2026-10-06T03:00:00.000Z"]);
  } });
  await getTurnos({ page: 1, limit: 20, fecha: "2026-10-05", estado: "SOLICITADO" }, user);
});
test("Errores conocidos de triggers se traducen sin ocultar errores inesperados", () => {
  for (const [message, statusCode] of [["La agenda esta bloqueada para la fecha y horario solicitados", 409],
    ["La duracion del turno no coincide con el horario configurado", 400],
    ["Se alcanzo el cupo maximo diario del horario", 409]]) {
    assert.throws(() => rethrowTurnoError({ code: "P0001", message }), { statusCode });
  }
  const unexpected = { code: "P0001", message: "Error desconocido" };
  assert.throws(() => rethrowTurnoError(unexpected), error => error === unexpected);
});
