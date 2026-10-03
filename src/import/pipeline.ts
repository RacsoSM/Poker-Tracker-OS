import type { RGBA } from '../image/rgba';
import { ocrColumns, ocrTable } from '../ocr/columns';
import type { OcrEngine } from '../ocr/engine';
import { detectKind } from '../parsers/detect';
import { emptyHandDraft, parseHand, type HandDraft } from '../parsers/hand';
import { buildHandLayout } from '../parsers/handLayout';
import { parseSummary, type SummaryDraft } from '../parsers/summary';
import type { RankTemplate } from '../vision/glyph';
import { syntheticHandId } from './syntheticId';

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

// Las capturas del móvil no enseñan ni el identificador ni la fecha de la mano, que son
// obligatorios para guardarla. Se rellenan con lo que se sabe del archivo: una huella de sus
// bytes y su fecha de modificación.
//
// La fecha sigue marcada para revisar, porque la del archivo puede no ser la de la partida
// (una captura reenviada por WhatsApp lleva la fecha de la descarga). El identificador
// inventado deja de estarlo: no es un dato que se pueda contrastar con la captura.
export function withImportFallbacks(draft: HandDraft, file: IncomingFile): HandDraft {
  if (draft.handId !== null && draft.playedAt !== null) return draft;
  return {
    ...draft,
    handId: draft.handId ?? syntheticHandId(file.bytes),
    playedAt: draft.playedAt ?? file.lastModified,
    uncertain: draft.handId === null ? draft.uncertain.filter((f) => f !== 'handId') : draft.uncertain,
  };
}

export async function analyzeFile(file: IncomingFile, deps: AnalyzeDeps): Promise<Analysis> {
  const image = await deps.decode(file);
  const full = await deps.engine.recognize(file.bytes, 'block');
  const kind = detectKind(full);
  if (kind === 'summary') return { kind, draft: parseSummary(full), image };
  if (kind === 'unknown') return { kind, image };
  const layout = buildHandLayout(image, full, deps.templates);
  if (!layout) return { kind: 'hand', draft: withImportFallbacks(emptyHandDraft(), file), image };
  const columns = await ocrColumns(deps.engine, image, layout);
  const table = await ocrTable(deps.engine, image, layout.headerTop);
  const draft = parseHand({ full, columns, table }, layout, deps.heroName);
  return { kind: 'hand', draft: withImportFallbacks(draft, file), image };
}
