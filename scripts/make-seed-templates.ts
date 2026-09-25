import { writeFileSync } from 'node:fs';
import { decodePng } from '../src/image/rgba';
import { detectCards } from '../src/vision/cards';
import { FIXTURE_HEADER_TOP, FIXTURE_TRUTH } from '../src/vision/fixtureTruth';
import { extractGlyph, glyphToString } from '../src/vision/glyph';
import { fixtureBytes, HAND_PNG } from '../src/test/fixtures';

const img = decodePng(fixtureBytes(HAND_PNG));
const cards = detectCards(img, FIXTURE_HEADER_TOP);
const seen = new Set<string>();
const seeds: { rank: string; sizeClass: string; glyph: string }[] = [];
for (const t of FIXTURE_TRUTH) {
  const card = cards.find((c) => Math.abs(c.x - t.x) <= 8 && Math.abs(c.y - t.y) <= 8);
  if (!card) throw new Error(`Carta no encontrada en ${t.x},${t.y}`);
  const key = `${t.rank}-${card.sizeClass}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const g = extractGlyph(img, card);
  if (!g) throw new Error(`Sin glifo en ${t.x},${t.y}`);
  seeds.push({ rank: t.rank, sizeClass: card.sizeClass, glyph: glyphToString(g) });
}
writeFileSync('src/vision/seedTemplates.json', JSON.stringify(seeds, null, 1) + '\n');
console.log(`Semillas escritas: ${seeds.map((s) => `${s.rank}/${s.sizeClass}`).join(', ')}`);
