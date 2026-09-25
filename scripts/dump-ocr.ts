import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodePng } from '../src/image/rgba';
import { ocrColumns } from '../src/ocr/columns';
import { createOcrEngine } from '../src/ocr/engine';
import { nodeOcrPaths } from '../src/ocr/nodePaths';
import { buildHandLayout } from '../src/parsers/handLayout';
import { FIXTURES_DIR, fixtureBytes, HAND_PNG, SUMMARY_PNG } from '../src/test/fixtures';
import { loadSeedTemplates } from '../src/vision/seeds';

const engine = await createOcrEngine(nodeOcrPaths());
const write = (name: string, data: unknown) => writeFileSync(resolve(FIXTURES_DIR, name), JSON.stringify(data, null, 1) + '\n');

write('session-summary-01.ocr.json', { full: await engine.recognize(fixtureBytes(SUMMARY_PNG), 'block') });

const handBytes = fixtureBytes(HAND_PNG);
const full = await engine.recognize(handBytes, 'block');
const img = decodePng(handBytes);
const layout = buildHandLayout(img, full, loadSeedTemplates());
if (!layout) throw new Error('No se encontró la cabecera de columnas en la mano');
write('hand-1323539300829384704.ocr.json', { full, columns: await ocrColumns(engine, img, layout) });

await engine.terminate();
console.log('Fixtures OCR generados');
