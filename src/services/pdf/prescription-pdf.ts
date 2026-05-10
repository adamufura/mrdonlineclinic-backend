import PDFDocument from 'pdfkit';

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
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('MRD Online Clinic — Prescription', { underline: true });
    doc.moveDown();
    doc.fontSize(10).text(`Rx #: ${input.prescriptionNumber}`);
    doc.text(`Issued: ${input.issuedAt.toISOString()}`);
    doc.moveDown();
    doc.fontSize(12).text(`Patient: ${input.patientName}`);
    doc.text(`Prescriber: ${input.practitionerName}`);
    doc.moveDown();
    doc.fontSize(12).text('Diagnosis', { underline: true });
    doc.fontSize(11).text(input.diagnosis);
    doc.moveDown();
    doc.fontSize(12).text('Medications', { underline: true });
    input.medications.forEach((m, i) => {
      doc.moveDown(0.3);
      doc.fontSize(11).text(`${i + 1}. ${m.drugName}`);
      doc.fontSize(10).text(`   Dosage: ${m.dosage} | Frequency: ${m.frequency} | Duration: ${m.duration}`);
      if (m.route) doc.text(`   Route: ${m.route}`);
      if (m.instructions) doc.text(`   Instructions: ${m.instructions}`);
    });
    if (input.additionalNotes) {
      doc.moveDown();
      doc.fontSize(12).text('Notes', { underline: true });
      doc.fontSize(10).text(input.additionalNotes);
    }
    doc.end();
  });
}
