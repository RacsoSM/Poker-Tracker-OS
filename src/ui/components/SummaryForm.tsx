import { useState } from 'react';
import { useSafeSave } from './useSafeSave';
import { DateTimeField, DurationField, MoneyField, NumberField } from './fields';

export interface SummaryFormInitial { startedAt: number | null; resultCny: number | null; hands: number | null; durationSec: number | null; note?: string }
export interface SummaryValues { startedAt: number; resultCny: number; hands: number; durationSec: number; note?: string }

export function SummaryForm({ initial, uncertain = [], onSave, onCancel, cancelLabel = 'Descartar' }: {
  initial: SummaryFormInitial;
  uncertain?: readonly string[];
  onSave: (v: SummaryValues) => void | Promise<void>;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const [startedAt, setStartedAt] = useState(initial.startedAt);
  const [resultCny, setResultCny] = useState(initial.resultCny);
  const [hands, setHands] = useState(initial.hands);
  const [durationSec, setDurationSec] = useState(initial.durationSec);
  const [note, setNote] = useState(initial.note ?? '');
  const flagged = new Set(uncertain);
  const { saving, error, run } = useSafeSave();
  const valid = startedAt !== null && resultCny !== null && hands !== null && durationSec !== null;
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void run(() => onSave({ startedAt: startedAt!, resultCny: resultCny!, hands: hands!, durationSec: durationSec!, note: note.trim() || undefined }));
      }}
    >
      <DateTimeField label="Fecha y hora" value={startedAt} onChange={setStartedAt} />
      <MoneyField label="Resultado ¥" value={resultCny} onChange={setResultCny} flagged={flagged.has('resultCny')} />
      <NumberField label="Manos" value={hands} onChange={setHands} integer flagged={flagged.has('hands')} />
      <DurationField value={durationSec} onChange={setDurationSec} flagged={flagged.has('durationSec')} />
      <label className="field">
        <span>Nota (opcional)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </label>
      {error && <p role="alert" className="warning">{error}</p>}
      <div className="btn-row">
        <button type="submit" className="btn primary" disabled={!valid || saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="btn" onClick={onCancel}>{cancelLabel}</button>
      </div>
    </form>
  );
}
