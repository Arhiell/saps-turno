import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { person, queue, drained, conflict } from "./patient-fixtures.js";
import { createTutorSchema } from "../src/validators/tutor.validator.js";
import { updateTutorSchema } from "../src/validators/tutor-update.validator.js";
const { registerTutor } = await import("../src/services/tutor.service.js");
const { getTutors, getTutorById } = await import("../src/services/tutor-read.service.js");
const { changeTutorStatus } = await import("../src/services/tutor-update.service.js");
const input = { dni: person.dni, nombres: person.nombres, apellidos: person.apellidos, telefono: "3777123456" };
const row = { id_tutor: "44444444-4444-4444-8444-444444444444", id_persona: person.id_persona,
  activo: true, persona: { ...person, telefono: input.telefono } };
afterEach(drained);

test("Tutor exige telefono y rechaza actualizaciones vacias o de estado", () => {
  assert.ok(createTutorSchema.safeParse(input).success);
  for (const telefono of [null, "", "123", undefined]) {
    assert.equal(createTutorSchema.safeParse({ ...input, telefono }).success, false);
  }
  for (const value of [{}, { telefono: null }, { activo: false }]) {
    assert.equal(updateTutorSchema.safeParse(value).success, false);
  }
});

test("Tutor no reutiliza una persona sin telefono", async () => {
  queue({ table: "personas", result: [person] }, { table: "tutores", result: [] },
    { table: "personas", result: [{ activo: true, telefono: null }] });
  await assert.rejects(registerTutor(input), { statusCode: 400 });
});

test("Tutor duplicado devuelve conflicto sin crear otro perfil", async () => {
  queue({ table: "personas", result: [person] }, { table: "tutores", result: [row] });
  await assert.rejects(registerTutor(input), conflict);
});

test("Listado de tutores pagina y filtra activos con respuesta plana", async () => {
  queue({ table: "tutores", result: [row], check: (url) => {
    assert.equal(url.searchParams.get("activo"), "eq.true");
    assert.equal(url.searchParams.get("offset"), "20");
    assert.equal(url.searchParams.get("limit"), "20");
  } });
  const result = await getTutors({ page: 2, limit: 20 });
  assert.equal(result.tutors[0]?.dni, person.dni);
  assert.equal("persona" in result.tutors[0]!, false);
});

test("Tutor inexistente devuelve 404", async () => {
  queue({ table: "tutores", result: [] });
  await assert.rejects(getTutorById(row.id_tutor), { statusCode: 404 });
});

test("Desactivar tutor modifica solo su perfil y comprueba estado previo", async () => {
  queue({ table: "tutores", result: [row] },
    { table: "tutores", method: "PATCH", result: [{ ...row, activo: false }], check: (url, body) => {
      assert.deepEqual(body, { activo: false });
      assert.equal(url.searchParams.get("activo"), "eq.true");
    } });
  assert.equal((await changeTutorStatus(row.id_tutor, false)).activo, false);
});

test("Reactivar tutor exige persona activa con telefono", async () => {
  queue({ table: "tutores", result: [{ ...row, activo: false }] },
    { table: "personas", result: [{ activo: false, telefono: input.telefono }] });
  await assert.rejects(changeTutorStatus(row.id_tutor, true), { statusCode: 400 });
});

test("Cambio concurrente de estado devuelve 409", async () => {
  queue({ table: "tutores", result: [row] }, { table: "tutores", method: "PATCH", result: [] });
  await assert.rejects(changeTutorStatus(row.id_tutor, false), conflict);
});
