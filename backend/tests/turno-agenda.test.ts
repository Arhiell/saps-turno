import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { queue, drained, input, horario, entities, freeSlot, id } from "./turno-fixtures.js";
import { createTurnoSchema } from "../src/validators/turno.validator.js";
import { updateTurnoSchema } from "../src/validators/turno-update.validator.js";
import { turnoQuerySchema } from "../src/validators/turno-query.validator.js";
import { agendaDayBounds } from "../src/utils/turno-time.js";
const { validateTurnoAgenda } = await import("../src/services/turno-agenda.service.js");
afterEach(drained);

test("Turnos valida UUID, fecha con zona, PATCH vacío y campos calculados", () => {
  assert.ok(createTurnoSchema.safeParse(input).success);
  for (const patch of [{ id_paciente: "x" }, { fecha_hora_inicio: "2099-02-30T10:00:00Z" },
    { fecha_hora_inicio: "2099-10-05T10:00:00" }, { fecha_hora_fin: "2099-10-05T11:00:00Z" },
    { estado: "CONFIRMADO" }, { creado_por: id }, { ocupa_agenda: false }]) {
    assert.equal(createTurnoSchema.safeParse({ ...input, ...patch }).success, false);
  }
  assert.equal(updateTurnoSchema.safeParse({}).success, false);
  assert.equal(updateTurnoSchema.safeParse({ id_paciente: id }).success, false);
  assert.equal(turnoQuerySchema.safeParse({ limit: 101 }).success, false);
  assert.equal(turnoQuerySchema.safeParse({ fecha: "2026-02-30" }).success, false);
});
test("Calcula final desde horario y convierte el día argentino sin depender de Node", async () => {
  queue(...entities(), { table: "horarios_atencion", result: [horario] }, ...freeSlot());
  const result = await validateTurnoAgenda(input);
  assert.equal(result.fecha_hora_fin, "2099-10-05T13:20:00.000Z");
  assert.deepEqual(agendaDayBounds("2026-10-05"), {
    start: "2026-10-05T03:00:00.000Z", end: "2026-10-06T03:00:00.000Z"
  });
});
test("Fecha pasada se rechaza sin consultar ni escribir", async () => {
  await assert.rejects(validateTurnoAgenda({ ...input, fecha_hora_inicio: "2020-01-01T10:00:00Z" }), { statusCode: 400 });
});
test("Paciente y profesional inexistentes producen 404", async () => {
  queue({ table: "pacientes", result: [] });
  await assert.rejects(validateTurnoAgenda(input), { statusCode: 404 });
  queue(entities()[0]!, { table: "profesionales", result: [] });
  await assert.rejects(validateTurnoAgenda(input), { statusCode: 404 });
});
test("Entidades inactivas o asociaciones vencidas impiden reservar", async () => {
  queue(entities()[0]!, { table: "profesionales", result: [{ activo: false }] });
  await assert.rejects(validateTurnoAgenda(input), { statusCode: 400 });
  const steps = entities();
  steps[4] = { table: "profesional_especialidad", result: [] };
  queue(...steps);
  await assert.rejects(validateTurnoAgenda(input), { statusCode: 400 });
});
test("Rechaza día, vigencia, franja, horario inactivo y bloques no alineados", async () => {
  for (const patch of [{ dia_semana: horario.dia_semana % 7 + 1 }, { activo: false },
    { vigencia_hasta: "2099-10-04" }, { vigencia_desde: "2099-10-06" },
    { hora_inicio: "11:00:00" }, { hora_fin: "10:10:00" }, { hora_inicio: "09:50:00" }]) {
    queue(...entities(), { table: "horarios_atencion", result: [{ ...horario, ...patch }] });
    await assert.rejects(validateTurnoAgenda(input), { statusCode: 400 });
  }
});
test("Consulta bloqueos globales, parciales y completos con solapamiento real", async () => {
  queue(...entities(), { table: "horarios_atencion", result: [horario] }, {
    table: "bloqueos_agenda", result: [{ id_bloqueo: id }], check: url => {
      const filter = url.searchParams.get("or")!;
      assert.ok(filter.includes("id_profesional.is.null"));
      assert.ok(filter.includes("id_especialidad.is.null"));
      assert.ok(filter.includes("dia_completo.eq.true"));
      assert.ok(filter.includes("hora_inicio.lt.10:20:00,hora_fin.gt.10:00:00"));
    }
  });
  await assert.rejects(validateTurnoAgenda(input), { statusCode: 409 });
});
test("Detecta superposición profesional, paciente y turno abierto de especialidad", async () => {
  for (const index of [1, 2, 3]) {
    const steps = freeSlot().slice(0, index);
    queue(...entities(), { table: "horarios_atencion", result: [horario] }, ...steps,
      { table: "turnos", result: [{ id_turno: id }], check: url => {
        if (index !== 3) {
          assert.equal(url.searchParams.get("fecha_hora_inicio"), "lt.2099-10-05T13:20:00.000Z");
          assert.equal(url.searchParams.get("fecha_hora_fin"), "gt.2099-10-05T13:00:00.000Z");
        }
      } });
    await assert.rejects(validateTurnoAgenda(input), { statusCode: 409 });
  }
});
test("Sanción vigente y cupo completo devuelven 409", async () => {
  queue(...entities(), { table: "horarios_atencion", result: [horario] }, ...freeSlot().slice(0, 4),
    { table: "sanciones", result: [{ id_sancion: id }] });
  await assert.rejects(validateTurnoAgenda(input), { statusCode: 409 });
  queue(...entities(), { table: "horarios_atencion", result: [{ ...horario, cupo_maximo_diario: 1 }] },
    ...freeSlot(), { table: "turnos", method: "HEAD", result: null });
  await assert.rejects(validateTurnoAgenda(input), { statusCode: 409 });
});
