import {
  Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun,
  Header, Footer, ImageRun, PageNumber, AlignmentType, WidthType,
} from 'docx';
import { reportDocument, reportLogo } from './reporte-documento.js';

export const generateWord = async (data: unknown, titulo: string) => {
  const report = reportDocument(data, titulo);
  const document = new Document({
    creator: 'CORA · Salud municipal', title: titulo,
    styles: { default: { document: { run: { font: 'Calibri', size: 20, color: '17212B' } } } },
    sections: report.secciones.map(section => ({
      properties: { page: { size: { width: 11906, height: 16838 },
        margin: { top: 1400, bottom: 1000, left: 800, right: 800, header: 400, footer: 400 } } },
      headers: { default: new Header({ children: [new Paragraph({
        children: [new ImageRun({ type: 'png', data: reportLogo, transformation: { width: 32, height: 32 } }),
          new TextRun({ text: '  CORA', bold: true, size: 36, color: '075C2C' }),
          new TextRun({ text: '  Salud municipal · SAPS Turno', size: 18, color: '667085' })],
        border: { bottom: { color: '075C2C', style: 'single', size: 8, space: 6 } },
      }), new Paragraph({ children: [new TextRun({
        text: section.cabecera.slice(2).filter(line => /^(Fecha:|Período:|Salita:|Profesional:)/.test(line)).join(' · '),
        size: 15, color: '667085',
      })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: `Emitido para descarga: ${report.generado}  ·  Página `, size: 16, color: '667085' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16 })],
      })] }) },
      children: [
        new Paragraph({ spacing: { after: 180 }, keepNext: true,
          children: [new TextRun({ text: section.cabecera[1] ?? titulo, bold: true, size: 28, color: '075C2C' })] }),
        ...section.cabecera.slice(2).map(text => new Paragraph({ text, spacing: { after: 70 } })),
        ...(section.columnas.length ? [new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: (section.anchos ?? section.columnas.map(() => 1)).map(value =>
            Math.floor(10306 * value / (section.anchos ?? section.columnas.map(() => 1)).reduce((a, b) => a + b, 0))),
          rows: [section.columnas, ...section.filas].map((row, index) => new TableRow({
            tableHeader: index === 0, cantSplit: index === 0,
            children: row.map(value => new TableCell({
              shading: { fill: index === 0 ? '075C2C' : index % 2 ? 'FFFFFF' : 'F0F6F2' },
              margins: { top: 90, bottom: 90, left: 90, right: 90 },
              children: String(value).split('\n').map(text => new Paragraph({
                children: [new TextRun({ text, size: 18, bold: index === 0, color: index === 0 ? 'FFFFFF' : '17212B' })],
              })),
            })),
          })),
        })] : []),
        ...section.pie.map(text => new Paragraph({ text, spacing: { before: 200 } })),
      ],
    })),
  });
  return Packer.toBuffer(document);
};
