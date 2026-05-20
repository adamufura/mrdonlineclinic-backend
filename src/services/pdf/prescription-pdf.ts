import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { CLINIC_BRANDING, PRESCRIPTION_VALIDITY_DAYS } from '../../config/clinic';

const LOGO_PATH = (() => {
  const candidates = [
    path.join(__dirname, 'logo.png'),
    path.resolve(__dirname, '../../../src/services/pdf/logo.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
})();

const NAVY = '#0f172a';
const SLATE = '#1e293b';
const TEAL = '#0f766e';
const TEAL_LIGHT = '#ccfbf1';
const BORDER = '#cbd5e1';
const MUTED = '#64748b';
const TEXT = '#334155';
const BG = '#f8fafc';
const WHITE = '#ffffff';

export type PrescriptionMedication = {
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  route?: string;
  instructions?: string;
};

/** All fields populated from DB when issuing; mock mirrors this shape exactly. */
export type PrescriptionPdfInput = {
  prescriptionNumber: string;
  issuedAt: Date;
  validUntil: Date;
  printedAt?: Date;
  appointmentDate?: Date | null;
  consultationRef?: string | null;
  patient: {
    fullName: string;
    dateOfBirth?: Date | null;
    gender?: string | null;
    bloodGroup?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  practitioner: {
    fullName: string;
    licenseNumber?: string | null;
    specialtyNames?: string[];
    email?: string | null;
    phone?: string | null;
    signatureImage?: Buffer | null;
  };
  diagnosis: string;
  medications: PrescriptionMedication[];
  additionalNotes?: string | null;
};

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(d: Date): string {
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatGender(g?: string | null): string {
  if (!g) return 'Not recorded';
  const map: Record<string, string> = {
    MALE: 'Male',
    FEMALE: 'Female',
    OTHER: 'Other',
    PREFER_NOT_SAY: 'Prefer not to say',
  };
  return map[g] ?? g;
}

function formatBloodGroup(bg?: string | null): string {
  if (!bg) return 'Not recorded';
  const map: Record<string, string> = {
    A_POS: 'A+',
    A_NEG: 'A−',
    B_POS: 'B+',
    B_NEG: 'B−',
    AB_POS: 'AB+',
    AB_NEG: 'AB−',
    O_POS: 'O+',
    O_NEG: 'O−',
    UNKNOWN: 'Unknown',
  };
  return map[bg] ?? bg.replace(/_/g, ' ');
}

function ageFromDob(dob?: Date | null): string {
  if (!dob) return '—';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? String(age) : '—';
}

function drawDateTile(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
) {
  doc.roundedRect(x, y, w, h, 5).fill(WHITE);
  doc.roundedRect(x, y, w, h, 5).lineWidth(0.75).strokeColor(BORDER).stroke();
  doc.font('Helvetica').fontSize(6.5).fillColor(MUTED).text(label.toUpperCase(), x + 10, y + 9, { width: w - 20 });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(value, x + 10, y + 22, { width: w - 20 });
}

function drawPanelHeader(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  x: number,
  y: number,
  width: number,
) {
  doc.rect(x, y, 4, 14).fill(TEAL);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(SLATE).text(title, x + 10, y + 2, { width: width - 14 });
}

function drawFieldRow(
  doc: InstanceType<typeof PDFDocument>,
  label: string,
  value: string,
  x: number,
  y: number,
  labelW: number,
  valueW: number,
) {
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(label, x, y, { width: labelW });
  doc.font('Helvetica').fontSize(9).fillColor(NAVY).text(value || '—', x + labelW, y - 0.5, { width: valueW });
}

export function buildPrescriptionPdf(input: PrescriptionPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 0,
      size: 'A4',
      info: {
        Title: `Prescription ${input.prescriptionNumber}`,
        Author: CLINIC_BRANDING.legalName,
        Subject: `Prescription for ${input.patient.fullName}`,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const margin = 36;
    const pageWidth = doc.page.width;
    const contentW = pageWidth - margin * 2;
    const printedAt = input.printedAt ?? new Date();

    // ═══ Letterhead (white, hospital-style — not full-bleed dark bar) ═══
    const headTop = 28;
    const logoSize = 52;

    doc.roundedRect(margin, headTop, logoSize, logoSize, 6).fill(BG);
    doc.roundedRect(margin, headTop, logoSize, logoSize, 6).lineWidth(0.5).strokeColor(BORDER).stroke();
    try {
      doc.image(LOGO_PATH, margin + 6, headTop + 6, { width: logoSize - 12, height: logoSize - 12 });
    } catch {
      /* optional */
    }

    const textX = margin + logoSize + 14;
    const textW = contentW - logoSize - 14 - 150;

    doc.font('Helvetica-Bold').fontSize(17).fillColor(NAVY).text(CLINIC_BRANDING.legalName, textX, headTop + 4, {
      width: textW,
    });
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text('Licensed telemedicine & outpatient pharmacy services', textX, headTop + 26, {
      width: textW,
    });

    // Rx block — right aligned, stamp style
    const rxW = 148;
    const rxX = pageWidth - margin - rxW;
    doc.roundedRect(rxX, headTop, rxW, 52, 4).fill(NAVY);
    doc.font('Helvetica').fontSize(7).fillColor('#94a3b8').text('Prescription No.', rxX + 10, headTop + 10, { width: rxW - 20 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(WHITE).text(input.prescriptionNumber, rxX + 10, headTop + 22, {
      width: rxW - 20,
    });
    if (input.consultationRef) {
      doc.font('Helvetica').fontSize(6.5).fillColor('#94a3b8').text(`Consultation ${input.consultationRef}`, rxX + 10, headTop + 38, {
        width: rxW - 20,
      });
    }

    const addrY = headTop + logoSize + 10;
    doc.moveTo(margin, addrY).lineTo(pageWidth - margin, addrY).lineWidth(1).strokeColor(TEAL).stroke();

    const colMid = margin + contentW * 0.55;
    doc.font('Helvetica').fontSize(8).fillColor(TEXT);
    doc.text(CLINIC_BRANDING.addressLine1, margin, addrY + 10, { width: colMid - margin - 8 });
    doc.text(CLINIC_BRANDING.addressLine2, margin, addrY + 22, { width: colMid - margin - 8 });
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED);
    doc.text(
      `Tel: ${CLINIC_BRANDING.phone}`,
      colMid,
      addrY + 10,
      { width: pageWidth - margin - colMid },
    );
    doc.text(`Email: ${CLINIC_BRANDING.email}`, colMid, addrY + 20, { width: pageWidth - margin - colMid });
    doc.text(`Web: ${CLINIC_BRANDING.website}`, colMid, addrY + 30, { width: pageWidth - margin - colMid });
    doc.text(
      `Facility licence ${CLINIC_BRANDING.facilityLicense} · RC ${CLINIC_BRANDING.taxId}`,
      margin,
      addrY + 36,
      { width: contentW },
    );

    // Document title strip
    const stripY = addrY + 52;
    doc.rect(margin, stripY, contentW, 26).fill(BG);
    doc.rect(margin, stripY, contentW, 26).lineWidth(0.5).strokeColor(BORDER).stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor(TEAL).text('OFFICIAL PRESCRIPTION RECEIPT', margin + 12, stripY + 8);
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('For pharmacy dispensing only', margin + 12, stripY + 18);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY).text(
      `Valid ${PRESCRIPTION_VALIDITY_DAYS} days from issue`,
      margin,
      stripY + 8,
      { width: contentW - 12, align: 'right' },
    );

    let y = stripY + 36;

    // ═══ Date tiles — 4 equal cards, single row ═══
    const tileGap = 8;
    const tileCount = 4;
    const tileW = (contentW - tileGap * (tileCount - 1)) / tileCount;
    const tileH = 40;

    const tiles: { label: string; value: string }[] = [
      { label: 'Date issued', value: formatDate(input.issuedAt) },
      { label: 'Valid until', value: formatDate(input.validUntil) },
      { label: 'Printed', value: formatDateTime(printedAt) },
      {
        label: 'Consultation date',
        value: input.appointmentDate ? formatDate(input.appointmentDate) : '—',
      },
    ];

    tiles.forEach((t, i) => {
      drawDateTile(doc, margin + i * (tileW + tileGap), y, tileW, tileH, t.label, t.value);
    });

    y += tileH + 18;

    // ═══ Patient & physician — side by side ═══
    const panelGap = 10;
    const panelW = (contentW - panelGap) / 2;
    const panelH = 128;

    const drawPartyPanel = (
      px: number,
      title: string,
      rows: { label: string; value: string }[],
      signature?: { image?: Buffer | null; name: string },
    ) => {
      doc.roundedRect(px, y, panelW, panelH, 6).fill(WHITE);
      doc.roundedRect(px, y, panelW, panelH, 6).lineWidth(0.75).strokeColor(BORDER).stroke();
      drawPanelHeader(doc, title, px + 12, y + 12, panelW - 24);

      let ry = y + 32;
      const labelW = 78;
      const valueW = panelW - labelW - 28;
      for (const row of rows) {
        drawFieldRow(doc, row.label, row.value, px + 14, ry, labelW, valueW);
        ry += 15;
      }

      if (signature) {
        const sigBoxY = y + panelH - 38;
        doc.font('Helvetica').fontSize(6.5).fillColor(MUTED).text('Authorised signature', px + 14, sigBoxY);
        const sigW = 110;
        const sigH = 26;
        const sigX = px + panelW - sigW - 14;
        if (signature.image) {
          try {
            doc.image(signature.image, sigX, sigBoxY + 8, { fit: [sigW, sigH], align: 'right' });
          } catch {
            doc.font('Helvetica-Oblique').fontSize(9).fillColor(TEXT).text(signature.name, sigX, sigBoxY + 14, {
              width: sigW,
              align: 'right',
            });
          }
        } else {
          doc.moveTo(sigX, sigBoxY + 30).lineTo(sigX + sigW, sigBoxY + 30).lineWidth(0.5).strokeColor(BORDER).stroke();
          doc.font('Helvetica').fontSize(6).fillColor(MUTED).text('Upload signature in practitioner profile', sigX, sigBoxY + 32, {
            width: sigW,
            align: 'center',
          });
        }
      }
    };

    const patientRows = [
      { label: 'Patient name', value: input.patient.fullName },
      {
        label: 'Date of birth',
        value: input.patient.dateOfBirth ? formatDate(input.patient.dateOfBirth) : 'Not recorded',
      },
      {
        label: 'Age / Sex',
        value: `${ageFromDob(input.patient.dateOfBirth)} years · ${formatGender(input.patient.gender)}`,
      },
      { label: 'Blood group', value: formatBloodGroup(input.patient.bloodGroup) },
      { label: 'Mobile', value: input.patient.phone ?? 'Not recorded' },
      { label: 'Email', value: input.patient.email ?? 'Not recorded' },
    ];

    const pracContact =
      [input.practitioner.phone, input.practitioner.email].filter(Boolean).join(' · ') || 'Not recorded';

    const practitionerRows = [
      { label: 'Physician', value: `Dr. ${input.practitioner.fullName}` },
      { label: 'Licence No.', value: input.practitioner.licenseNumber ?? 'Not recorded' },
      {
        label: 'Specialty',
        value:
          input.practitioner.specialtyNames && input.practitioner.specialtyNames.length > 0
            ? input.practitioner.specialtyNames.join(' · ')
            : 'Not recorded',
      },
      { label: 'Contact', value: pracContact },
    ];

    drawPartyPanel(margin, 'Patient details', patientRows);
    drawPartyPanel(margin + panelW + panelGap, 'Prescribing physician', practitionerRows, {
      image: input.practitioner.signatureImage,
      name: `Dr. ${input.practitioner.fullName}`,
    });

    y += panelH + 16;

    // ═══ Diagnosis ═══
    drawPanelHeader(doc, 'Clinical diagnosis', margin, y, contentW);
    y += 20;
    doc.font('Helvetica').fontSize(10);
    const diagH = Math.max(32, doc.heightOfString(input.diagnosis, { width: contentW - 24 }) + 20);
    doc.roundedRect(margin, y, contentW, diagH, 4).fill(TEAL_LIGHT);
    doc.roundedRect(margin, y, contentW, diagH, 4).lineWidth(0.5).strokeColor('#99f6e4').stroke();
    doc.font('Helvetica').fontSize(10).fillColor(SLATE).text(input.diagnosis, margin + 12, y + 10, {
      width: contentW - 24,
      lineGap: 2,
    });
    y += diagH + 14;

    // ═══ Medications ═══
    drawPanelHeader(doc, 'Medicines prescribed (Rx)', margin, y, contentW);
    y += 18;

    const tableX = margin;
    const col = { num: 20, drug: 148, dosage: 68, freq: 82, duration: 62, route: 48 };
    const headerH = 18;

    doc.rect(tableX, y, contentW, headerH).fill(SLATE);
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(7);
    let cx = tableX + 8;
    doc.text('#', cx, y + 5, { width: col.num });
    cx += col.num;
    doc.text('Medicine', cx, y + 5, { width: col.drug });
    cx += col.drug;
    doc.text('Dose', cx, y + 5, { width: col.dosage });
    cx += col.dosage;
    doc.text('Frequency', cx, y + 5, { width: col.freq });
    cx += col.freq;
    doc.text('Duration', cx, y + 5, { width: col.duration });
    cx += col.duration;
    doc.text('Route', cx, y + 5, { width: col.route });
    y += headerH;

    input.medications.forEach((m, i) => {
      const rowH = m.instructions ? 34 : 20;
      if (i % 2 === 0) doc.rect(tableX, y, contentW, rowH).fill(BG);

      doc.fillColor(TEXT).font('Helvetica').fontSize(8);
      cx = tableX + 8;
      doc.text(String(i + 1), cx, y + 5, { width: col.num });
      cx += col.num;
      doc.font('Helvetica-Bold').fillColor(NAVY).text(m.drugName, cx, y + 5, { width: col.drug });
      cx += col.drug;
      doc.font('Helvetica').fillColor(TEXT);
      doc.text(m.dosage, cx, y + 5, { width: col.dosage });
      cx += col.dosage;
      doc.text(m.frequency, cx, y + 5, { width: col.freq });
      cx += col.freq;
      doc.text(m.duration, cx, y + 5, { width: col.duration });
      cx += col.duration;
      doc.text(m.route || 'Oral', cx, y + 5, { width: col.route });

      if (m.instructions) {
        doc.font('Helvetica-Oblique').fontSize(7).fillColor(MUTED);
        doc.text(m.instructions, tableX + 8 + col.num, y + 18, { width: contentW - col.num - 16 });
      }
      y += rowH;
    });

    doc.moveTo(tableX, y).lineTo(tableX + contentW, y).strokeColor(BORDER).lineWidth(0.75).stroke();
    y += 12;

    if (input.additionalNotes?.trim()) {
      drawPanelHeader(doc, 'Pharmacy / clinical notes', margin, y, contentW);
      y += 18;
      doc.font('Helvetica').fontSize(9).fillColor(TEXT).text(input.additionalNotes.trim(), margin, y, {
        width: contentW,
        lineGap: 3,
      });
      y += doc.heightOfString(input.additionalNotes.trim(), { width: contentW }) + 14;
    }

    // ═══ Footer ═══
    const footerY = Math.max(y + 16, doc.page.height - 88);
    doc.moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).strokeColor(BORDER).lineWidth(0.5).stroke();

    doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(
      'This document is issued electronically by MRD Online Clinic. The dispensing pharmacist must confirm the prescription number, validity dates, and patient identity before release of medicines. Controlled drugs are subject to additional statutory checks.',
      margin,
      footerY + 8,
      { width: contentW, align: 'justify', lineGap: 1 },
    );

    doc.font('Helvetica-Bold').fontSize(7).fillColor(NAVY).text(
      `${input.prescriptionNumber}  ·  Issued ${formatDate(input.issuedAt)}  ·  Expires ${formatDate(input.validUntil)}`,
      margin,
      footerY + 36,
      { width: contentW, align: 'center' },
    );

    doc.end();
  });
}

/** Fetch signature image from URL for embedding in PDF (best-effort). */
export async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}
