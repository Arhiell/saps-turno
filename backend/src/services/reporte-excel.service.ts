import ExcelJS from 'exceljs';
import { reportDocument, reportLogo } from './reporte-documento.js';

export const generateExcel = async (data: unknown, titulo: string) => {
  const report = reportDocument(data, titulo);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CORA · Salud municipal';
  workbook.created = new Date();
  const info = workbook.addWorksheet('Información');
  const logo = workbook.addImage({ base64: `data:image/png;base64,${reportLogo.toString('base64')}`, extension: 'png' });
  info.addImage(logo, { tl: { col: 0, row: 0 }, ext: { width: 40, height: 40 } });
  info.mergeCells('B1:F2');
  info.getCell('B1').value = 'CORA · Salud municipal';
  info.getCell('B1').font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FF075C2C' } };
  info.getColumn(1).width = 9;
  for (let col = 2; col <= 6; col++) info.getColumn(col).width = 20;
  let line = 4;
  const addInfo = (text: string, bold = false) => {
    info.mergeCells(line, 1, line, 6);
    const cell = info.getCell(line, 1);
    cell.value = text;
    cell.font = { name: 'Calibri', size: 11, bold, color: { argb: 'FF17212B' } };
    cell.alignment = { wrapText: true, vertical: 'middle' };
    info.getRow(line).height = Math.max(22, Math.ceil(text.length / 100) * 16);
    line++;
  };
  addInfo(`Emitido para descarga: ${report.generado}`, true);
  const headings = new Set(report.secciones.flatMap(section => section.cabecera.slice(1)));
  for (const heading of headings) addInfo(heading);
  addInfo('Los filtros de las tablas permiten analizar los registros. Las fechas corresponden a Argentina.');
  const sheets = report.excel ? [report.excel] : report.secciones.map((section, index) => ({
    nombre: section.nombre ?? `Reporte ${index + 1}`, columnas: section.columnas, filas: section.filas,
  }));
  sheets.forEach((section, index) => {
    const name = section.nombre.replace(/[\/*?:\[\]\\]/g, ' ').slice(0, 26);
    const sheet = workbook.addWorksheet(`${index + 1} ${name}`, {
      views: [{ state: 'frozen', ySplit: 1 }],
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      headerFooter: { oddHeader: '&LCORA · Salud municipal', oddFooter: `&LEmitido: ${report.generado}&RPágina &P de &N` },
    });
    const rows = section.filas.map(row => row.map((value, col) => {
      // Fechas nativas para filtros; DNI y códigos permanecen como texto.
      if (section.columnas[col] === 'Fecha' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Date(`${value}T00:00:00Z`);
      }
      return value;
    }));
    if (section.columnas.length) {
      if (rows.length) sheet.addTable({ name: `Reporte${index + 1}`, ref: 'A1', headerRow: true,
        style: { theme: 'TableStyleMedium4', showRowStripes: true },
        columns: section.columnas.map(name => ({ name, filterButton: true })), rows });
      else { sheet.addRow(section.columnas); sheet.addRow(['No hay registros para los filtros seleccionados.']); }
      section.columnas.forEach((label, col) => {
        const column = sheet.getColumn(col + 1);
        column.width = Math.min(48, Math.max(14, label.length + 3,
          ...section.filas.slice(0, 100).map(row => Math.min(48, String(row[col] ?? '').length + 2))));
        if (label === 'Fecha') column.numFmt = 'dd/mm/yyyy';
        if (['DNI', 'Código de turno', 'Matrícula'].includes(label)) column.numFmt = '@';
      });
      sheet.getRow(1).height = 28;
      sheet.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF075C2C' } };
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      });
      sheet.eachRow((row, rowNumber) => {
        row.alignment = { vertical: 'top', wrapText: true };
        if (rowNumber > 1) {
          row.font = { name: 'Calibri', size: 11, color: { argb: 'FF17212B' } };
          let lines = 1;
          row.eachCell((cell, col) => {
            const text = cell.value instanceof Date ? '' : String(cell.value ?? '');
            lines = Math.max(lines, ...text.split('\n').map(part => Math.ceil(part.length / ((sheet.getColumn(col).width ?? 20) - 2))));
          });
          row.height = Math.min(409, Math.max(24, lines * 15 + 6));
        }
      });
      sheet.pageSetup.printTitlesRow = '1:1';
    } else sheet.addRow(['No hay registros para los filtros seleccionados.']);
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
};
