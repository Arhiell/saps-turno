import type { 
  AgendaLista, 
  ReporteSecciones 
} from "../types/reporte-agenda.types.js";
import { reportTimestamp, reportDate, reportLogo } from './reporte-documento.js';

export const agendaSecciones = (
  listas: AgendaLista[], 
  fecha: string, fechaHasta?: string, contexto: string[] = []): ReporteSecciones => (
    {
      generado: reportTimestamp(),
      excel: {
        nombre: 'Turnos',
        columnas: ['Fecha', 'Hora', 'Código de turno', 'Paciente', 'DNI', 'Estado', 'Motivo', 'Salita', 'Dirección', 'Profesional', 'Matrícula', 'Especialidad'],
        filas: listas.flatMap(lista => lista.pacientes.map(p => [
          lista.fecha, p.hora, p.codigo_turno, p.apellido_nombre, p.dni,
          p.estado_nombre ?? p.estado, p.motivo_consulta ?? '', lista.salita, lista.direccion ?? '',
          lista.profesional, lista.matricula ?? '', lista.especialidad,
        ])),
      },
      secciones: listas.length ? listas.map(lista => (
        {
          nombre: `${lista.fecha} ${lista.profesional}`,
          anchos: [0.8, 0.7, 2.1, 1.15, 1.2, 2.2],
          cabecera: [
            "CORA · Salud municipal",
            "Registro de turnos y atención",
            `Período: ${reportDate(fecha)} al ${reportDate(fechaHasta ?? fecha)}`,
            `Fecha: ${lista.fecha.split("-").reverse().join("/")}`,
            `Salita: ${lista.salita}`, 
            ...(lista.direccion ? [`Dirección: ${lista.direccion}`

            ] : []
          ),
          `Profesional: ${lista.profesional}`,
          `Matrícula: ${lista.matricula ?? 'No registrada'}`,
          `Especialidad: ${lista.especialidad}`,
          `Total de turnos: ${lista.total_pacientes}`,
          contexto.find(line => line.startsWith('Estado:')) ?? 'Estado: Todos los estados',
        ],
        columnas: ["Turno", "Hora", "Paciente", "DNI", "Estado", "Motivo"],
        filas: lista.pacientes.map((p) => [p.codigo_turno,
          p.hora,
          p.apellido_nombre,
          p.dni, p.estado_nombre ?? p.estado,
          p.motivo_consulta ?? ""
        ]
      ),
      pie: [
        `Total de turnos: ${lista.total_pacientes} · Atendidos: ${lista.pacientes.filter(p => p.estado === 'ATENDIDO').length} · Inasistencias: ${lista.pacientes.filter(p => p.estado === 'NO_ASISTIO').length}`,
        "Firma del profesional: ______________________"],
      }
    )
  ) : [
    { cabecera: [
      "CORA · Salud municipal",
      "Registro de turnos y atención",
      ...contexto,
      `Fecha: ${fecha.split("-").reverse().join("/")}${fechaHasta && fechaHasta !== fecha ? ` al ${fechaHasta.split("-").reverse().join("/")}` : ""}`
    ],
    columnas: [],
    filas: [], 
    pie: ["No hay turnos registrados para los filtros seleccionados."]
  }
],
}
);

// Escapa datos personales antes de insertarlos en el documento imprimible.
const escape = (value: string) => value.replace(/[&<>"']/g, char =>
  ({ 
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;", 
    "'": "&#39;" 
  }
)[char]!);

export const agendaHtml = (data: ReporteSecciones) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>
  CORA — Registro de turnos y atención
</title><style>

@page{
  size:A4;
  margin:15mm
} body{
 font:12px Arial, sans-serif;color:#000;background:#fff}
section{break-after:page}section:last-child{break-after:auto}h1{font-size:20px;color:#075c2c}p{margin:6px 0}
.brand{display:flex;align-items:center;gap:12px;border-bottom:2px solid #075c2c;padding-bottom:10px}.brand img{width:36px;height:36px}
th{background:#075c2c;color:white}tbody tr:nth-child(even){background:#f0f6f2}.issued{color:#667085;font-size:10px}
table{width:100%;border-collapse:collapse;margin:18px 0}th,td{border:1px solid #777;padding:7px;text-align:left;overflow-wrap:anywhere}
thead{display:table-header-group}tr{break-inside:avoid}footer{margin-top:20px} @media print{.ayuda{display:none}}
</style></head><body><p class="ayuda">Para imprimir, usá Ctrl+P o la opción Imprimir del navegador.</p>${data.secciones.map(s =>
  `<section><div class="brand"><img alt="CORA" src="data:image/png;base64,${reportLogo.toString('base64')}"><h1>${escape(s.cabecera[0] ?? "CORA")}</h1></div>${s.cabecera.slice(1).map(line => `<p>${escape(line)}</p>`).join("")}
  <table><thead><tr>${s.columnas.map(c => `<th>${escape(c)}</th>`).join("")}</tr></thead><tbody>${s.filas.map(row =>
    `<tr>${row.map(cell => `<td>${escape(String(cell))}</td>`).join("")}</tr>`).join("")}</tbody></table>
  <footer>${s.pie.map(line => `<p>${escape(line)}</p>`).join("")}<p class="issued">Emitido para descarga: ${escape(data.generado ?? reportTimestamp())}</p></footer></section>`).join("")}</body></html>`;
