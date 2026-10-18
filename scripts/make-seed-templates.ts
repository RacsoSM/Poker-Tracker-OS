import { writeFileSync } from 'node:fs';
import { decodePng } from '../src/image/rgba';
import { parseHand, type HandOcr } from '../src/parsers/hand';
import { buildHandLayout } from '../src/parsers/handLayout';
import { detectCards } from '../src/vision/cards';
import { FIXTURE_HEADER_TOP, FIXTURE_TRUTH } from '../src/vision/fixtureTruth';
import { extractGlyph, glyphDistance, glyphFromString, glyphToString } from '../src/vision/glyph';
import { fixtureBytes, fixtureJson, HAND_PNG } from '../src/test/fixtures';
import { MOBILE_TRUTH } from '../src/test/mobileTruth';

const seeds: { rank: string; sizeClass: string; glyph: string }[] = [];
// Un glifo casi idéntico a otra semilla del mismo rango no aporta nada.
const add = (rank: string, sizeClass: string, glyph: string) => {
  const g = glyphFromString(glyph);
  if (seeds.some((s) => s.rank === rank && glyphDistance(glyphFromString(s.glyph), g) < 0.03)) return;
  seeds.push({ rank, sizeClass, glyph });
};

// Captura de escritorio.
const img = decodePng(fixtureBytes(HAND_PNG));
const cards = detectCards(img, FIXTURE_HEADER_TOP);
for (const t of FIXTURE_TRUTH) {
  const card = cards.find((c) => Math.abs(c.x - t.x) <= 8 && Math.abs(c.y - t.y) <= 8);
  if (!card) throw new Error(`Carta no encontrada en ${t.x},${t.y}`);
  const g = extractGlyph(img, card);
  if (!g) throw new Error(`Sin glifo en ${t.x},${t.y}`);
  add(t.rank, card.sizeClass, glyphToString(g));
}

// Capturas del móvil: las cartas del héroe y del tablero, con su rango verdadero.
for (const t of MOBILE_TRUTH) {
  const ocr = fixtureJson<HandOcr>(t.png.replace(/\.png$/, '.ocr.json'));
  const layout = buildHandLayout(decodePng(fixtureBytes(t.png)), ocr.full, []);
  if (!layout) throw new Error(`Sin cabecera en ${t.png}`);
  for (const g of parseHand(ocr, layout, 'RacsoSM').glyphs) {
    const truth = g.slot === 'hero' ? t.cards : t.board;
    add(truth[g.index * 2], g.sizeClass, g.glyph);
  }
}

writeFileSync('src/vision/seedTemplates.json', JSON.stringify(seeds, null, 1) + '\n');
console.log(`${seeds.length} semillas: ${[...new Set(seeds.map((s) => s.rank))].join(' ')}`);
