import assert from "node:assert/strict";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { queue, drained } from "./patient-fixtures.js";

const { default: app } = await import("../src/app.js");
const { generateAccessToken } = await import("../src/services/jwt.service.js");

// Una sola prueba recorre rutas, validadores, controladores, repositorio y exportadores.
// La base se simula; Express y la generación de PDF, Excel y Word son reales.
test("Reportes: integración de consultas, permisos, validación y exportaciones", async (t) => {
  const transportErrors: unknown[] = [];
  const fixtureFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    try { return await fixtureFetch(...args); }
    catch (error) { transportErrors.push(error); throw error; }
  };
  t.after(() => { globalThis.fetch = fixtureFetch; });
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  if (!server.listening) await new Promise<void>(resolve => server.once("listening", resolve));
  const id = "11111111-1111-4111-8111-111111111111";
  const token = await generateAccessToken({ id_usuario: id, email: "test@example.com", nombre_usuario: "test", rol: "SUPER_ADMIN" });
  const auth = (role = "SUPER_ADMIN") => [
    { table: "usuarios", result: [{ id_usuario: id, id_rol: id, activo: true }] },
    { table: "roles", result: [{ codigo: role, activo: true }] },
  ];
  const rows = ["ATENDIDO", "ATENDIDO", "CANCELADO", "NO_ASISTIO"].map((codigo, index) => ({
    id_turno: id, id_paciente: id, id_profesional: id, id_especialidad: id, id_salita: id,
    estado: index % 2 ? [{ codigo }] : { codigo },
    especialidad: { id_especialidad: id, nombre: "Clínica" },
    profesional: { id_profesional: id, persona: { nombres: "Ana", apellidos: "Pérez" } },
  }));
  const filters = `fecha_desde=2026-09-01&fecha_hasta=2026-09-20&id_salita=${id}`;
  const data = (result: unknown = rows) => ({ table: "turnos", result, check: (url: URL) => {
    assert.equal(url.searchParams.get("id_salita"), "eq." + id);
    assert.deepEqual(url.searchParams.getAll("fecha_hora_inicio"),
      ["gte.2026-09-01T00:00:00-03:00", "lte.2026-09-20T23:59:59.999-03:00"]);
    assert.ok(url.searchParams.get("select")?.includes("estado:estados_turno!turnos_id_estado_fkey"));
  } });
  const call = (path: string, authenticated = true): Promise<{ status: number; headers: import("node:http").IncomingHttpHeaders; body: Buffer }> => new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port: (server.address() as AddressInfo).port,
      path: "/api/reportes" + path, agent: false,
      headers: authenticated ? { Authorization: "Bearer " + token } : {} }, res => {
      const chunks: Buffer[] = [];
      res.on("data", chunk => chunks.push(Buffer.from(chunk)));
      res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.setTimeout(60000, () => req.destroy(new Error("Tiempo de espera HTTP agotado")));
    req.end();
  });
  const expected = {
    resumen: { periodo: { desde: "2026-09-01", hasta: "2026-09-20" }, total_turnos: 4,
      atenciones_realizadas: 2, cancelaciones: 1, inasistencias: 1, pacientes_atendidos: 1 },
    especialidades: [{ id_especialidad: id, nombre: "Clínica", total_turnos: 4, atendidos: 2, inasistencias: 1, cancelados: 1 }],
    profesionales: [{ id_profesional: id, profesional: "Ana Pérez", total_turnos: 4, atendidos: 2, inasistencias: 1, cancelados: 1 }],
  };
  for (const route of ["resumen", "especialidades", "profesionales", "exportar"]) {
    assert.equal((await call(`/${route}?${filters}`, false)).status, 401);
    queue(...auth("PACIENTE"));
    assert.equal((await call(`/${route}?${filters}`)).status, 403);
    drained();
  }
  for (const path of ["/resumen?fecha_desde=2026-09-21&fecha_hasta=2026-09-20",
    "/especialidades?fecha_desde=incorrecta", `/profesionales?${filters}&id_salita=incorrecto`,
    `/exportar?${filters}&tipo=resumen&formato=csv`]) {
    queue(...auth()); assert.equal((await call(path)).status, 400); drained();
  }
  for (const tipo of ["resumen", "especialidades", "profesionales"] as const) {
    queue(...auth(), data());
    const response = await call(`/${tipo}?${filters}`);
    assert.equal(response.status, 200);
    const json = JSON.parse(response.body.toString());
    assert.equal(json.ok, true); assert.deepEqual(json.reporte, expected[tipo]);
    if (tipo !== "resumen") assert.equal(json.total, 1);
    drained();
    for (const [formato, mime] of [
      ["pdf", "application/pdf"],
      ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ]) {
      queue(...auth(), data());
      const file = await call(`/exportar?${filters}&tipo=${tipo}&formato=${formato}`);
      assert.equal(file.status, 200); assert.equal(file.headers["content-type"], mime);
      assert.equal(file.headers["content-disposition"], `attachment; filename="reporte-${tipo}-2026-09-01-2026-09-20.${formato}"`);
      assert.ok(file.body.length > 100);
      if (formato === "pdf") {
        assert.equal(file.body.subarray(0, 5).toString(), "%PDF-");
        assert.ok(file.body.subarray(-20).toString().includes("%%EOF"));
      } else {
        assert.equal(file.body.subarray(0, 2).toString(), "PK");
        if (formato === "docx") assert.ok(file.body.includes(Buffer.from("word/document.xml")));
        else {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(file.body);
          const sheet = workbook.getWorksheet("Reporte")!;
          assert.equal(sheet.getCell("A1").value, `Reporte SAPS - ${tipo}`);
          assert.equal(sheet.rowCount, 4);
          const records = Array.isArray(expected[tipo]) ? expected[tipo] : [expected[tipo]];
          const record = records[0]!;
          // ExcelJS indexa las celdas desde 1 y deja vacío el índice 0.
          assert.deepEqual(Array.from(sheet.getRow(3).values as ExcelJS.CellValue[]).slice(1), Object.keys(record));
          assert.deepEqual(Array.from(sheet.getRow(4).values as ExcelJS.CellValue[]).slice(1), Object.values(record).map(value => typeof value === "object" ? JSON.stringify(value) : value));
        }
      }
      drained();
    }
  }
  queue(...auth(), data([]));
  assert.deepEqual(JSON.parse((await call(`/especialidades?${filters}`)).body.toString()), { ok: true, total: 0, reporte: [] });
  drained();
  queue(...auth(), { table: "turnos", status: 400, result: { code: "XX000", message: "database failure" } });
  const failure = await call(`/resumen?${filters}`);
  assert.equal(failure.status, 500);
  assert.equal(JSON.parse(failure.body.toString()).message, "No se pudieron obtener los datos del reporte");
  drained();
  assert.deepEqual(transportErrors, []);
});
