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
  /** Reloj, para poder fijarlo en las pruebas. */
  now?: () => number;
}

// Ni el identificador ni la fecha se sacan ya de la captura: el "HAND ID" de WPT sale mal del
// OCR más veces de las que sale bien, y las capturas del móvil ni siquiera lo enseñan, así que
// acababa tecleándolos el usuario en cada mano. Se generan siempre.
//
// El identificador es una huella de los bytes del archivo, no un número cualquiera: volver a
// subir la misma captura da el mismo y salta el aviso de mano repetida.
//
// La fecha es la del momento de subir la foto. Ninguno de los dos queda marcado para revisar:
// no son lecturas dudosas, son valores puestos a propósito.
export function importedHandDraft(draft: HandDraft, file: IncomingFile, now: number): HandDraft {
  return { ...draft, handId: syntheticHandId(file.bytes), playedAt: now };
}

export async function analyzeFile(file: IncomingFile, deps: AnalyzeDeps): Promise<Analysis> {
  const image = await deps.decode(file);
  const full = await deps.engine.recognize(file.bytes, 'block');
  const kind = detectKind(full);
  if (kind === 'summary') return { kind, draft: parseSummary(full), image };
  if (kind === 'unknown') return { kind, image };
  const now = (deps.now ?? Date.now)();
  const layout = buildHandLayout(image, full, deps.templates);
  if (!layout) return { kind: 'hand', draft: importedHandDraft(emptyHandDraft(), file, now), image };
  const columns = await ocrColumns(deps.engine, image, layout);
  const table = await ocrTable(deps.engine, image, layout.headerTop);
  const draft = parseHand({ full, columns, table }, layout, deps.heroName);
  return { kind: 'hand', draft: importedHandDraft(draft, file, now), image };
}
