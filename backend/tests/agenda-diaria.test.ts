import assert from "node:assert/strict";
import { before, after, afterEach, test } from "node:test";
import ExcelJS from "exceljs";
import { auth, scope, data, queue, drained, curl, id, other, row, user } from "./agenda-diaria-fixtures.js";
import { agendaDateTime, agendaDayBounds } from "../src/utils/turno-time.js";
const { default: app } = await import("../src/app.js");
const { generateAccessToken } = await import("../src/services/jwt.service.js");
const { getAgendaDiaria } = await import("../src/services/reporte-agenda-diaria.service.js");
const server = app.listen(0, "127.0.0.1");
before(async () => { if (!server.listening) await new Promise<void>(resolve => server.once("listening", resolve)); });
after(() => new Promise<void>(resolve => server.close(() => resolve())));
afterEach(drained);
const token = await generateAccessToken(user);
const call = (path: string, authenticated = true) => curl(server, token, path, authenticated);
const date = "?fecha=2026-09-21";

test("curl: hoy, mañana y fecha manual usan el día argentino", async () => {
  const today = agendaDateTime(new Date()).date;
  const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  for (const [query, expected] of [["", today], ["?fecha=hoy", today], ["?fecha=manana", tomorrow], [date, "2026-09-21"]]) {
    const bounds = agendaDayBounds(expected!);
    queue(...auth(), data([], url => assert.deepEqual(url.searchParams.getAll("fecha_hora_inicio"), [`gte.${bounds.start}`, `lt.${bounds.end}`])));
    const result = await call(query!); assert.equal(result.status, 200); assert.equal(result.json().fecha, expected);
  }
});
test("curl: filtros de salita, profesional, especialidad y estado llegan a SQL", async () => {
  queue(...auth(), { table: "estados_turno", data: [{ id_estado: other, codigo: "CONFIRMADO", es_estado_final: false }] }, data([row], url => {
    for (const key of ["id_salita", "id_profesional", "id_especialidad"]) assert.equal(url.searchParams.get(key), "eq." + id);
    assert.equal(url.searchParams.get("id_estado"), "eq." + other);
  }));
  const result = await call(`${date}&id_salita=${id}&id_profesional=${id}&id_especialidad=${id}&estado=CONFIRMADO`);
  assert.equal(result.status, 200); assert.equal(result.json().listas[0].pacientes[0].hora, "08:00");
});
test("curl: ADMIN_SALITA solo consulta asignaciones vigentes, incluso sin filtro de salita", async () => {
  for (const path of [date, `${date}&id_salita=${id}`, `${date}&id_profesional=${other}`]) {
    queue(...auth("ADMIN_SALITA"), scope([id, other]), data([], url =>
      assert.ok(url.searchParams.getAll("id_salita").includes(`in.(${id},${other})`))));
    assert.equal((await call(path)).status, 200);
  }
});
test("curl: otra salita devuelve 403 en consulta, impresión y todos los formatos", async () => {
  for (const path of [`${date}&id_salita=${other}`, `/imprimir${date}&id_salita=${other}`,
    ...["pdf", "xlsx", "docx"].map(formato => `/exportar${date}&id_salita=${other}&formato=${formato}`)]) {
    queue(...auth("ADMIN_SALITA"), scope()); assert.equal((await call(path)).status, 403);
  }
});
test("curl: sin asignaciones y profesional sin turnos devuelven lista vacía", async () => {
  queue(...auth("ADMIN_SALITA"), scope([])); assert.deepEqual((await call(date)).json().listas, []);
  queue(...auth(), data([])); const result = await call(`${date}&id_profesional=${other}`);
  assert.equal(result.status, 200); assert.deepEqual(result.json().listas, []);
});
test("curl: fecha, UUID, estado y formato inválidos devuelven 400", async () => {
  for (const path of ["?fecha=2026-02-30", `${date}&id_salita=bad`, `${date}&id_profesional=bad`,
    `${date}&id_especialidad=bad`, `${date}&estado=bad!`, `/exportar${date}&formato=csv`]) {
    queue(...auth()); assert.equal((await call(path)).status, 400);
  }
});
test("curl: JWT obligatorio y roles no administrativos rechazados", async () => {
  for (const path of [date, `/exportar${date}&formato=pdf`, `/imprimir${date}`]) {
    assert.equal((await call(path, false)).status, 401);
    for (const role of ["PACIENTE", "RECEPCION"]) {
      queue(...auth(role)); assert.equal((await call(path)).status, 403);
    }
  }
  await assert.rejects(getAgendaDiaria({ fecha: "2026-09-21" }, { ...user, rol: "RECEPCION" }), { statusCode: 403 });
});

test("Profesional consulta y exporta exclusivamente su agenda aunque cambie el filtro", async () => {
  for (const path of [`${date}&id_profesional=${other}`, `/exportar${date}&id_profesional=${other}&formato=pdf`]) {
    queue(...auth("PROFESIONAL"),
      { table: "usuarios", data: [{ ...user, id_persona: id }] },
      { table: "profesionales", data: [{ id_profesional: id }] },
      data([row], url => assert.equal(url.searchParams.get("id_profesional"), "eq." + id)));
    assert.equal((await call(path)).status, 200);
  }
});
test("curl: estados finales nunca se presentan como pacientes a atender", async () => {
  for (const codigo of ["CANCELADO", "REPROGRAMADO", "ATENDIDO", "NO_ASISTIO"]) {
    queue(...auth(), { table: "estados_turno", data: [{ id_estado: other, codigo, es_estado_final: true }] });
    const result = await call(`${date}&estado=${codigo}`); assert.equal(result.status, 200); assert.deepEqual(result.json().listas, []);
  }
});
test("curl: agrupación, datos de cabecera y orden de pacientes", async () => {
  queue(...auth(), data([row, { ...row, id_turno: other, fecha_hora_inicio: "2026-09-21T11:20:00Z" },
    { ...row, id_profesional: other, profesional: { persona: { nombres: "Ana", apellidos: "Zárate" } } }]));
  const response = await call(date); const lists = response.json().listas;
  assert.equal(response.status, 200); assert.equal(lists.length, 2); assert.equal(response.json().total_pacientes, 3);
  assert.equal(lists[0].direccion, "Belgrano 100"); assert.equal(lists[0].total_pacientes, 2);
  assert.deepEqual(lists[0].pacientes.map((p: any) => p.hora), ["08:00", "08:20"]);
  assert.equal(lists[0].pacientes[0].apellido_nombre, "Gómez María"); assert.equal(lists[0].pacientes[0].dni, "30111222");
});
test("curl: exportaciones reales por profesional y de toda la salita", async () => {
  for (const formato of ["pdf", "xlsx", "docx"]) for (const individual of [true, false]) {
    const rows = individual ? [row] : [row, { ...row, id_profesional: other }];
    queue(...auth("ADMIN_SALITA"), scope(), data(rows));
    const file = await call(`/exportar${date}&id_salita=${id}&formato=${formato}${individual ? `&id_profesional=${id}` : ""}`);
    assert.equal(file.status, 200); assert.match(file.headers, /Cache-Control: no-store/i);
    assert.ok(file.headers.includes(`.${formato}"`));
    if (formato === "pdf") { assert.equal(file.body.subarray(0, 5).toString(), "%PDF-"); assert.ok(file.body.toString().includes("595.28 841.89")); }
    if (formato === "docx") { assert.equal(file.body.subarray(0, 2).toString(), "PK"); assert.ok(file.body.includes(Buffer.from("word/document.xml"))); }
    if (formato === "xlsx") {
      const book = new ExcelJS.Workbook(); await book.xlsx.load(file.body);
      assert.equal(book.worksheets.length, rows.length);
      assert.equal(book.worksheets[0]!.getCell("A1").value, "SAPS TURNO");
      assert.equal(book.worksheets[0]!.getCell("F1").master.address, "A1");
      assert.ok(JSON.stringify(book.worksheets[0]!.getSheetValues()).includes("30111222"));
    }
  }
});
test("curl: impresión escapa HTML y PDF soporta motivos largos", async () => {
  queue(...auth(), data([{ ...row, motivo_consulta: "<script>alert(1)</script>" }]));
  const html = await call(`/imprimir${date}`);
  assert.equal(html.status, 200); assert.ok(html.body.toString().includes("&lt;script&gt;"));
  assert.ok(!html.body.toString().includes("<script>")); assert.ok(html.body.toString().includes("size:A4"));
  queue(...auth(), data([{ ...row, motivo_consulta: "Control prolongado ".repeat(110) }]));
  assert.equal((await call(`/exportar${date}&formato=pdf`)).status, 200);
});
test("curl: exportación no pierde pacientes al superar una página de Supabase", async () => {
  queue(...auth(), data(Array.from({ length: 100 }, () => row), undefined, 101),
    data([row], url => assert.equal(url.searchParams.get("offset"), "100"), 101));
  assert.equal((await call(date)).json().total_pacientes, 101);
});
test("curl: error de base de datos no expone datos de pacientes", async () => {
  queue(...auth(), { table: "turnos", status: 400, data: { code: "XX000", message: "private details" } });
  const result = await call(date); assert.equal(result.status, 500); assert.ok(!result.body.toString().includes("private details"));
});
