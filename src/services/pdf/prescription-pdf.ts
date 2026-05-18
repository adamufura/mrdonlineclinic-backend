import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';

// In dev (tsx), __dirname = src/services/pdf
// In prod (compiled), __dirname = dist/services/pdf — logo lives in src/
const LOGO_PATH = (() => {
  const candidates = [
    path.join(__dirname, 'logo.png'),
    path.resolve(__dirname, '../../../src/services/pdf/logo.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0]; // fallback; image() will be wrapped in try/catch
})();

// Brand colors
const BRAND_NAVY = '#0a1628';
const BRAND_TEAL = '#0d9488';
const BRAND_SKY = '#0284c7';
const GRAY_600 = '#475569';
const GRAY_400 = '#94a3b8';
const GRAY_200 = '#e2e8f0';
const WHITE = '#ffffff';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function buildPrescriptionPdf(input: {
  prescriptionNumber: string;
  patientName: string;
  practitionerName: string;
  diagnosis: string;
  medications: { drugName: string; dosage: string; frequency: string; duration: string; route?: string; instructions?: string }[];
  additionalNotes?: string;
  issuedAt: Date;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      info: {
        Title: `Prescription ${input.prescriptionNumber}`,
        Author: 'MRD Online Clinic',
        Subject: `Prescription for ${input.patientName}`,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 100; // 50 margin each side
    const centerX = doc.page.width / 2;

    // ─── Header with logo and clinic name (centered) ───
    try {
      doc.image(LOGO_PATH, centerX - 25, 40, { width: 50, height: 50 });
    } catch {
      // If logo fails to load, skip it gracefully
    }

    doc.moveDown(0.5);
    doc.y = 95;
    doc.font('Helvetica-Bold').fontSize(18).fillColor(BRAND_NAVY)
      .text('MRD Online Clinic', { align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor(GRAY_400)
      .text('Telemedicine Healthcare Services', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(8).fillColor(GRAY_400)
      .text('www.mrdonline.ng', { align: 'center' });

    // ─── Divider line ───
    doc.moveDown(0.8);
    const divY = doc.y;
    doc.moveTo(50, divY).lineTo(doc.page.width - 50, divY)
      .strokeColor(BRAND_TEAL).lineWidth(2).stroke();

    // ─── Prescription title ───
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND_TEAL)
      .text('PRESCRIPTION', { align: 'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor(GRAY_600)
      .text(input.prescriptionNumber, { align: 'center' });

    // ─── Patient & Prescriber info box ───
    doc.moveDown(1);
    const infoBoxY = doc.y;
    const infoBoxHeight = 70;

    // Light background box
    doc.roundedRect(50, infoBoxY, pageWidth, infoBoxHeight, 4)
      .fillColor('#f8fafc').fill();

    // Left column — Patient
    doc.fillColor(GRAY_400).font('Helvetica').fontSize(8);
    doc.text('PATIENT', 65, infoBoxY + 12);
    doc.fillColor(BRAND_NAVY).font('Helvetica-Bold').fontSize(11);
    doc.text(input.patientName, 65, infoBoxY + 25);

    // Right column — Prescriber
    const rightCol = 50 + pageWidth / 2 + 10;
    doc.fillColor(GRAY_400).font('Helvetica').fontSize(8);
    doc.text('PRESCRIBER', rightCol, infoBoxY + 12);
    doc.fillColor(BRAND_NAVY).font('Helvetica-Bold').fontSize(11);
    doc.text(`Dr. ${input.practitionerName}`, rightCol, infoBoxY + 25);

    // Date row
    doc.fillColor(GRAY_400).font('Helvetica').fontSize(8);
    doc.text('DATE ISSUED', 65, infoBoxY + 48);
    doc.fillColor(GRAY_600).font('Helvetica').fontSize(10);
    doc.text(formatDate(input.issuedAt), 65, infoBoxY + 60);

    // Vertical separator in info box
    const sepX = 50 + pageWidth / 2;
    doc.moveTo(sepX, infoBoxY + 10).lineTo(sepX, infoBoxY + infoBoxHeight - 10)
      .strokeColor(GRAY_200).lineWidth(1).stroke();

    doc.y = infoBoxY + infoBoxHeight + 20;

    // ─── Diagnosis section ───
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND_SKY)
      .text('DIAGNOSIS', 50);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11).fillColor(BRAND_NAVY)
      .text(input.diagnosis, 50, undefined, { width: pageWidth });

    // ─── Medications section ───
    doc.moveDown(1.2);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND_SKY)
      .text('MEDICATIONS', 50);
    doc.moveDown(0.5);

    // Table header
    const tableX = 50;
    const tableHeaderY = doc.y;
    const colWidths = { num: 25, drug: 140, dosage: 80, frequency: 90, duration: 70, route: 60 };

    doc.roundedRect(tableX, tableHeaderY, pageWidth, 22, 3)
      .fillColor(BRAND_NAVY).fill();

    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(8);
    let colX = tableX + 8;
    doc.text('#', colX, tableHeaderY + 7, { width: colWidths.num });
    colX += colWidths.num;
    doc.text('Drug Name', colX, tableHeaderY + 7, { width: colWidths.drug });
    colX += colWidths.drug;
    doc.text('Dosage', colX, tableHeaderY + 7, { width: colWidths.dosage });
    colX += colWidths.dosage;
    doc.text('Frequency', colX, tableHeaderY + 7, { width: colWidths.frequency });
    colX += colWidths.frequency;
    doc.text('Duration', colX, tableHeaderY + 7, { width: colWidths.duration });
    colX += colWidths.duration;
    doc.text('Route', colX, tableHeaderY + 7, { width: colWidths.route });

    doc.y = tableHeaderY + 22;

    // Table rows
    input.medications.forEach((m, i) => {
      const rowY = doc.y;
      const rowHeight = m.instructions ? 34 : 22;
      const bgColor = i % 2 === 0 ? '#f8fafc' : WHITE;

      doc.rect(tableX, rowY, pageWidth, rowHeight).fillColor(bgColor).fill();

      doc.fillColor(GRAY_600).font('Helvetica').fontSize(9);
      colX = tableX + 8;
      doc.text(String(i + 1), colX, rowY + 6, { width: colWidths.num });
      colX += colWidths.num;
      doc.font('Helvetica-Bold').fillColor(BRAND_NAVY);
      doc.text(m.drugName, colX, rowY + 6, { width: colWidths.drug });
      colX += colWidths.drug;
      doc.font('Helvetica').fillColor(GRAY_600);
      doc.text(m.dosage, colX, rowY + 6, { width: colWidths.dosage });
      colX += colWidths.dosage;
      doc.text(m.frequency, colX, rowY + 6, { width: colWidths.frequency });
      colX += colWidths.frequency;
      doc.text(m.duration, colX, rowY + 6, { width: colWidths.duration });
      colX += colWidths.duration;
      doc.text(m.route || '—', colX, rowY + 6, { width: colWidths.route });

      if (m.instructions) {
        doc.font('Helvetica-Oblique').fontSize(8).fillColor(GRAY_400);
        doc.text(`↳ ${m.instructions}`, tableX + 8 + colWidths.num, rowY + 20, { width: pageWidth - colWidths.num - 16 });
      }

      doc.y = rowY + rowHeight;
    });

    // Table bottom border
    doc.moveTo(tableX, doc.y).lineTo(tableX + pageWidth, doc.y)
      .strokeColor(GRAY_200).lineWidth(1).stroke();

    // ─── Additional notes ───
    if (input.additionalNotes) {
      doc.moveDown(1.2);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND_SKY)
        .text('ADDITIONAL NOTES', 50);
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10).fillColor(GRAY_600)
        .text(input.additionalNotes, 50, undefined, { width: pageWidth });
    }

    // ─── Footer ───
    doc.moveDown(2);
    const footerY = Math.max(doc.y, doc.page.height - 120);
    doc.y = footerY;

    // Signature line
    doc.moveTo(50, footerY).lineTo(220, footerY)
      .strokeColor(GRAY_200).lineWidth(1).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(GRAY_400);
    doc.text('Prescriber Signature', 50, footerY + 5);

    // Footer divider
    const footDivY = doc.page.height - 60;
    doc.moveTo(50, footDivY).lineTo(doc.page.width - 50, footDivY)
      .strokeColor(GRAY_200).lineWidth(0.5).stroke();

    // Footer text
    doc.font('Helvetica').fontSize(7).fillColor(GRAY_400);
    doc.text(
      'This prescription was generated electronically by MRD Online Clinic. It is valid without a physical signature.',
      50, footDivY + 8,
      { width: pageWidth, align: 'center' },
    );
    doc.text(
      `${input.prescriptionNumber} · Generated ${input.issuedAt.toISOString().split('T')[0]}`,
      50, footDivY + 22,
      { width: pageWidth, align: 'center' },
    );

    doc.end();
  });
}
