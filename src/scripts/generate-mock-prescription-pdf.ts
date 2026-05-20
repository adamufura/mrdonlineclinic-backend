/**
 * Generate a sample prescription PDF (no database required).
 *
 * Usage:
 *   npm run prescription:mock
 *
 * Output:
 *   output/mock-prescription.pdf  (relative to backend root)
 */
import fs from 'fs';
import path from 'path';

async function main() {
  const outDir = path.resolve(process.cwd(), 'output');
  const outFile = path.join(outDir, 'mock-prescription.pdf');
  const sigArg = process.argv.find((a) => a.startsWith('--signature='));
  const sigPath = sigArg?.split('=').slice(1).join('=');

  console.log('Generating mock prescription PDF…');
  const { buildMockPrescriptionPdfInput } = await import('../modules/prescriptions/prescription-pdf-data');
  const { buildPrescriptionPdf } = await import('../services/pdf/prescription-pdf');
  const input = buildMockPrescriptionPdfInput();
  if (sigPath && fs.existsSync(sigPath)) {
    input.practitioner.signatureImage = fs.readFileSync(sigPath);
    console.log(`Using signature image: ${sigPath}`);
  }
  const buffer = await buildPrescriptionPdf(input);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, buffer);

  console.log(`Done. Open this file to preview:\n  ${outFile}\n`);
  console.log('Tip: upload a practitioner signature in the dashboard to see it on real prescriptions.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
