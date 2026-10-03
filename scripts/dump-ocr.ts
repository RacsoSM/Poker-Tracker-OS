import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodePng } from '../src/image/rgba';
import { ocrColumns, ocrTable } from '../src/ocr/columns';
import { createOcrEngine } from '../src/ocr/engine';
import { nodeOcrPaths } from '../src/ocr/nodePaths';
import { buildHandLayout } from '../src/parsers/handLayout';
import { FIXTURES_DIR, fixtureBytes, HAND_PNG, MOBILE_HAND_PNGS, MOBILE_SUMMARY_PNG, SUMMARY_PNG } from '../src/test/fixtures';
import { loadSeedTemplates } from '../src/vision/seeds';

const engine = await createOcrEngine(nodeOcrPaths());
const write = (name: string, data: unknown) => writeFileSync(resolve(FIXTURES_DIR, name), JSON.stringify(data, null, 1) + '\n');

for (const png of [SUMMARY_PNG, MOBILE_SUMMARY_PNG]) {
  write(png.replace(/\.png$/, '.ocr.json'), { full: await engine.recognize(fixtureBytes(png), 'block') });
}

for (const png of [HAND_PNG, ...MOBILE_HAND_PNGS]) {
  const handBytes = fixtureBytes(png);
  const full = await engine.recognize(handBytes, 'block');
  const img = decodePng(handBytes);
  const layout = buildHandLayout(img, full, loadSeedTemplates());
  if (!layout) throw new Error(`No se encontró la cabecera de columnas en ${png}`);
  write(png.replace(/\.png$/, '.ocr.json'), {
    full,
    columns: await ocrColumns(engine, img, layout),
    table: await ocrTable(engine, img, layout.headerTop),
  });
}

await engine.terminate();
console.log('Fixtures OCR generados');
