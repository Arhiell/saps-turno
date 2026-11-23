import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { input, person, row, queue, drained, conflict } from "./patient-fixtures.js";
import { createPatientSchema } from "../src/validators/patient.validator.js";
import { updatePatientSchema } from "../src/validators/patient-update.validator.js";
import { createPersonSchema } from "../src/validators/person.validator.js";
import { duplicateMessages } from "../src/utils/duplicate-error.js";
const { registerPatient } = await import("../src/services/patient.service.js");
const { editPatient, changePatientStatus } = await import("../src/services/patient-update.service.js");
const { getPatients, getPatientById, getPatientByDni } = await import("../src/services/patient-read.service.js");

afterEach(drained);

test("Búsqueda por nombre completo conserva todas las palabras, paginación y alcance de sala", async () => {
  for (const search of ["Juan Perez", "Perez, Juan", "  Juan   Perez  "]) {
    queue({ table: "pacientes", result: [row], check: url => {
      const filter = url.searchParams.get("persona.or")!;
      assert.ok(filter.startsWith("(and("));
      assert.match(filter, /nombres\.ilike\."\*Juan\*"/);
      assert.match(filter, /apellidos\.ilike\."\*Perez\*"/);
      assert.equal(url.searchParams.get("id_salita_asignada"), `in.(${input.id_salita_asignada})`);
      assert.equal(url.searchParams.get("offset"), "10");
      assert.equal(url.searchParams.get("limit"), "10");
    } });
    const result = await getPatients({ page: 2, limit: 10, search }, [input.id_salita_asignada]);
    assert.equal(result.pagination.page, 2);
    drained();
  }
});

test("Búsqueda normaliza DNI con puntos y no convierte signos en un listado completo", async () => {
  queue({ table: "pacientes", result: [row], check: url =>
    assert.match(url.searchParams.get("persona.or")!, /dni\.ilike\."\*40111222\*"/) });
  await getPatients({ page: 1, limit: 10, search: "40.111.222" });
  drained();
  queue();
  for (const search of ["%,()", "...", "---"]) {
    const result = await getPatients({ page: 1, limit: 10, search });
    assert.equal(result.pagination.total, 0);
  }
});

test("Validaciones compartidas y requisitos exclusivos de pacientes", () => {
  assert.ok(createPatientSchema.safeParse(input).success);
  assert.ok(createPersonSchema.safeParse({ dni: input.dni, nombres: "Juan", apellidos: "Perez" }).success);
  for (const field of ["fecha_nacimiento", "sexo", "direccion"]) {
    assert.equal(createPatientSchema.safeParse({ ...input, [field]: undefined }).success, false);
  }
  for (const bad of [{ dni: "123" }, { dni: "1234567890123456" },
    { sexo: "OTRO" }, { fecha_nacimiento: "2999-01-01" },
    { fecha_nacimiento: "2025-02-30" }, { email: "incorrecto" }, { id_usuario: input.id_barrio }]) {
    assert.equal(createPatientSchema.safeParse({ ...input, ...bad }).success, false);
  }
  for (const bad of [{}, { activo: false }, { fecha_nacimiento: "2999-01-01" }]) {
    assert.equal(updatePatientSchema.safeParse(bad).success, false);
  }
  assert.ok(updatePatientSchema.safeParse({ telefono: null, obra_social: "PAMI" }).success);
});

test("Alta nueva separa datos y devuelve una respuesta plana", async () => {
  queue(
    { table: "personas", result: [] },
    { table: "personas", method: "POST", result: person, check: (_, body) => {
      assert.equal(body?.dni, input.dni); assert.equal(body?.id_barrio, undefined);
    }},
    { table: "pacientes", result: [] },
    { table: "pacientes", method: "POST", result: row, check: (_, body) => {
      assert.deepEqual(body, {
        id_persona: person.id_persona, id_barrio: input.id_barrio,
        id_salita_asignada: input.id_salita_asignada
      });
    }}
  );
  const result = await registerPatient(input);
  assert.equal(result?.dni, input.dni);
  assert.equal(result?.id_persona, person.id_persona);
  assert.equal("persona" in result!, false);
});

test("Reutiliza persona sin sobrescribir sus datos", async () => {
  queue({ table: "personas", result: [person] }, { table: "pacientes", result: [] },
    { table: "pacientes", method: "POST", result: row });
  assert.equal((await registerPatient({ ...input, nombres: "Otro" }))?.nombres, "Juan");
});

test("Paciente existente, incluso inactivo, devuelve 409", async () => {
  queue({ table: "personas", result: [person] },
    { table: "pacientes", result: [{ ...row, activo: false }] });
  await assert.rejects(registerPatient(input), (error) =>
    conflict(error) && (error as Error).message === duplicateMessages.dni);
});

test("Recupera persona creada concurrentemente y traduce duplicado de perfil", async () => {
  queue({ table: "personas", result: [] },
    { table: "personas", method: "POST", status: 409, result: { code: "23505" } },
    { table: "personas", result: [person] }, { table: "pacientes", result: [] },
    { table: "pacientes", method: "POST", status: 409, result: { code: "23505" } },
    { table: "pacientes", result: [row] });
  await assert.rejects(registerPatient(input), conflict);
});

test("Listado activo, paginado y ordenado por apellidos de persona", async () => {
  queue({ table: "pacientes", result: [row], check: (url) => {
    assert.equal(url.searchParams.get("activo"), "eq.true");
    assert.equal(url.searchParams.get("offset"), "20");
    assert.equal(url.searchParams.get("limit"), "20");
    assert.equal(url.searchParams.get("order"),
      "persona(apellidos).asc,persona(nombres).asc,id_paciente.asc");
    assert.match(url.searchParams.get("select")!, /persona:personas!inner/);
  }});
  const result = await getPatients({ page: 2, limit: 20 });
  assert.equal(result.pagination.total, 1);
  assert.equal(result.patients[0]?.dni, person.dni);
});

test("Lectura por ID permite inactivos y por DNI filtra la relación", async () => {
  queue(
    { table: "pacientes", result: [{ ...row, activo: false }], check: (url) =>
      assert.equal(url.searchParams.has("activo"), false) },
    { table: "pacientes", result: [row], check: (url) =>
      assert.equal(url.searchParams.get("persona.dni"), "eq." + input.dni) }
  );
  assert.equal((await getPatientById(row.id_paciente)).activo, false);
  assert.equal((await getPatientByDni(input.dni)).id_paciente, row.id_paciente);
});

test("PATCH mixto escribe cada campo únicamente en su tabla", async () => {
  queue({ table: "pacientes", result: [row] },
    { table: "pacientes", method: "PATCH", result: row, check: (_, body) =>
      assert.deepEqual(body, { obra_social: "PAMI" }) },
    { table: "personas", result: [person] },
    { table: "personas", method: "PATCH", result: person, check: (_, body) =>
      assert.deepEqual(body, { telefono: null }) },
    { table: "pacientes", result: [{ ...row, obra_social: "PAMI" }] });
  assert.equal((await editPatient(row.id_paciente, { telefono: null, obra_social: "PAMI" }))?.obra_social, "PAMI");
});

test("DNI ocupado por persona sin perfil de paciente también devuelve 409", async () => {
  queue({ table: "pacientes", result: [row] },
    { table: "personas", result: [{ ...person, id_persona: "otra-persona" }] });
  await assert.rejects(editPatient(row.id_paciente, { dni: "12345678", obra_social: "PAMI" }), conflict);
});

test("Error de cobertura de PostgREST produce 400 sin modificar persona", async () => {
  queue({ table: "pacientes", result: [row] },
    { table: "pacientes", method: "PATCH", status: 400,
      result: { message: "La salita asignada no cubre el barrio del paciente", code: "P0001" } });
  await assert.rejects(editPatient(row.id_paciente, { id_barrio: input.id_barrio, telefono: "123" }),
    (error: unknown) => error instanceof Error && "statusCode" in error && error.statusCode === 400);
});

test("Estado modifica solamente pacientes.activo", async () => {
  queue({ table: "pacientes", result: [row] },
    { table: "pacientes", method: "PATCH", result: { ...row, activo: false },
      check: (_, body) => assert.deepEqual(body, { activo: false }) });
  assert.equal((await changePatientStatus(row.id_paciente, false)).activo, false);
});

test("Paciente inexistente devuelve 404", async () => {
  queue({ table: "pacientes", result: [] });
  await assert.rejects(getPatientById(row.id_paciente), (error: unknown) =>
    error instanceof Error && "statusCode" in error && error.statusCode === 404);
});
