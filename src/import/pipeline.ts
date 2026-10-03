import type { RGBA } from '../image/rgba';
import { ocrColumns, ocrTable } from '../ocr/columns';
import type { OcrEngine } from '../ocr/engine';
import { detectKind } from '../parsers/detect';
import { emptyHandDraft, parseHand, type HandDraft } from '../parsers/hand';
import { buildHandLayout } from '../parsers/handLayout';
import { parseSummary, type SummaryDraft } from '../parsers/summary';
import type { RankTemplate } from '../vision/glyph';

export interface IncomingFile { bytes: Uint8Array; mime: string; lastModified: number; name: string }

export type Analysis =
  | { kind: 'summary'; draft: SummaryDraft; image: RGBA }
  | { kind: 'hand'; draft: HandDraft; image: RGBA }
  | { kind: 'unknown'; image: RGBA };

export interface AnalyzeDeps {
  engine: OcrEngine;
  decode: (f: IncomingFile) => Promise<RGBA>;
  templates: RankTemplate[];
  heroName: string;
}

export async function analyzeFile(file: IncomingFile, deps: AnalyzeDeps): Promise<Analysis> {
  const image = await deps.decode(file);
  const full = await deps.engine.recognize(file.bytes, 'block');
  const kind = detectKind(full);
  if (kind === 'summary') return { kind, draft: parseSummary(full), image };
  if (kind === 'unknown') return { kind, image };
  const layout = buildHandLayout(image, full, deps.templates);
  if (!layout) return { kind: 'hand', draft: emptyHandDraft(), image };
  const columns = await ocrColumns(deps.engine, image, layout);
  const table = await ocrTable(deps.engine, image, layout.headerTop);
  return { kind: 'hand', draft: parseHand({ full, columns, table }, layout, deps.heroName), image };
}
