/**
 * One-off helper: reads a flat or nested JSON locale file (en) and writes Hausa (ha)
 * via the internal translation service. Usage:
 *
 *   npx tsx src/scripts/bootstrap-ha-locale.ts path/to/en/common.json path/to/output/ha/common.json
 *
 * Requires MONGODB_URI and TRANSLATION_API_* in .env (uses cache after first run).
 */
import fs from 'fs';
import path from 'path';
import { config as loadDotenv } from 'dotenv';
import { connectDb } from '../config/db';
import { translateText } from '../services/translation.service';

loadDotenv();

type JsonNode = string | Record<string, unknown>;

async function translateNode(node: JsonNode): Promise<JsonNode> {
  if (typeof node === 'string') {
    if (!node.trim()) return node;
    const { translatedText } = await translateText(node, 'ha');
    return translatedText;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    out[key] = await translateNode(value as JsonNode);
  }
  return out;
}

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error('Usage: tsx src/scripts/bootstrap-ha-locale.ts <en.json> <ha.json>');
    process.exit(1);
  }

  await connectDb();
  const en = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8')) as JsonNode;
  const ha = await translateNode(en);
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(ha, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outputPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
