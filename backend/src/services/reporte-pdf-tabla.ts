import type { ReporteSecciones } from '../types/reporte-agenda.types.js';
import { reportLogo } from './reporte-documento.js';

const green = '#075c2c';
const ink = '#17212b';

export const drawReporteSections = (doc: PDFKit.PDFDocument, data: ReporteSecciones) => {
  const left = 40;
  const width = doc.page.width - 80;
  const bottom = doc.page.height - 64;
  let page = 0;
  let title = '';
  let context = '';
  const pageHeader = () => {
    page++;
    doc.image(reportLogo, left, 30, { width: 32, height: 32 });
    doc.font('Helvetica-Bold').fontSize(20).fillColor(green).text('CORA', left + 43, 29, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(ink).text('Salud municipal · SAPS Turno', left + 44, 53, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(12).text(title, left, 78, { width, height: 18 });
    doc.font('Helvetica').fontSize(7).fillColor('#667085').text(context, left, 96, { width, height: 22, ellipsis: true });
    doc.moveTo(left, 121).lineTo(left + width, 121).lineWidth(1).strokeColor(green).stroke();
    const oldMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor('#667085')
      .text(`Emitido para descarga: ${data.generado ?? ''}`, left, doc.page.height - 35, { lineBreak: false });
    doc.text(`Página ${page}`, doc.page.width - 90, doc.page.height - 35, { lineBreak: false });
    doc.page.margins.bottom = oldMargin;
    doc.fillColor(ink);
    doc.x = left;
    doc.y = 134;
  };
  doc.on('pageAdded', pageHeader);

  for (const [sectionIndex, section] of data.secciones.entries()) {
    title = section.cabecera[1] ?? 'Informe de actividad';
    context = section.cabecera.slice(2).filter(line => /^(Fecha:|Período:|Salita:|Profesional:)/.test(line)).join(' · ');
    if (sectionIndex) doc.addPage(); else pageHeader();
    for (const line of section.cabecera.slice(2)) {
      doc.font('Helvetica').fontSize(9).fillColor(ink);
      doc.text(line, left, doc.y, { width, lineGap: 2 });
      doc.y += 3;
    }
    doc.y += 10;
    const weights = section.anchos ?? section.columnas.map(() => 1);
    const sum = weights.reduce((total, value) => total + value, 0) || 1;
    const widths = weights.map(value => width * value / sum);
    const linesFor = (value: string, cellWidth: number) => {
      const lines = [''];
      for (const char of value) {
        const last = lines.length - 1;
        if (char === '\n') lines.push('');
        else if (doc.widthOfString(lines[last] + char) > cellWidth - 12) lines.push(char);
        else lines[last] += char;
      }
      return lines;
    };
    const row = (values: (string | number)[], heading = false, index = 0) => {
      doc.font(heading ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      const lines = values.map((value, i) => linesFor(String(value), widths[i] ?? 60));
      while (lines.some(cell => cell.length)) {
        if (doc.y + 24 > bottom) {
          doc.addPage();
          if (!heading) row(section.columnas, true);
        }
        const count = Math.max(1, Math.min(Math.max(...lines.map(cell => cell.length)), Math.floor((bottom - doc.y - 12) / 11)));
        const height = count * 11 + 12;
        const y = doc.y;
        let x = left;
        lines.forEach((cell, i) => {
          const cellWidth = widths[i] ?? 60;
          doc.rect(x, y, cellWidth, height).fill(heading ? green : index % 2 ? '#f0f6f2' : '#ffffff');
          doc.rect(x, y, cellWidth, height).lineWidth(0.4).strokeColor('#d9e4dd').stroke();
          doc.font(heading ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(heading ? '#ffffff' : ink);
          cell.splice(0, count).forEach((line, lineIndex) =>
            doc.text(line, x + 6, y + 6 + lineIndex * 11, { lineBreak: false }));
          x += cellWidth;
        });
        doc.x = left;
        doc.y = y + height;
      }
    };
    if (section.columnas.length) row(section.columnas, true);
    section.filas.forEach((values, index) => row(values, false, index));
    doc.y += 14;
    for (const line of section.pie) {
      if (doc.y + 30 > bottom) doc.addPage();
      doc.font('Helvetica').fontSize(9).fillColor(ink).text(line, left, doc.y, { width, lineGap: 3 });
      doc.y += 5;
    }
  }
};
