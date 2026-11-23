import PDFDocument from 'pdfkit';
import { drawReporteSections } from './reporte-pdf-tabla.js';
import { reportDocument } from './reporte-documento.js';

export const generatePdf = (data: unknown, titulo: string): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 134, bottom: 64, left: 40, right: 40 },
      info: { Title: titulo, Author: 'CORA · Salud municipal', Creator: 'CORA' } });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    try {
      drawReporteSections(doc, reportDocument(data, titulo));
      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
