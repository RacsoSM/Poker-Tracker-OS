import { useState } from 'react';
import { fmtCny } from '../../domain/format';
import { allinEv } from '../../domain/stats';
import { POSITIONS, STREETS, type HandValues, type Position, type Street } from '../../domain/types';
import { isSyntheticHandId } from '../../import/syntheticId';
import type { PartialCard } from '../../parsers/hand';
import { CardPicker } from './CardPicker';
import { DateTimeField, MoneyField, NumberField } from './fields';
import { useSafeSave } from './useSafeSave';
import { toHandValues, type HandFormState } from './handValidation';

const STREET_LABEL: Record<Street, string> = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn' };

export function HandForm({ initial, uncertain = [], onSave, onCancel, cancelLabel = 'Descartar' }: {
  initial: HandFormState;
  uncertain?: readonly string[];
  onSave: (v: HandValues) => void | Promise<void>;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const [s, setS] = useState<HandFormState>(initial);
  const set = <K extends keyof HandFormState>(k: K, v: HandFormState[K]) => setS((prev) => ({ ...prev, [k]: v }));
  const setAllin = (patch: Partial<HandFormState['allin']>) => setS((prev) => ({ ...prev, allin: { ...prev.allin, ...patch } }));
  const flagged = new Set(uncertain);
  const { saving, error, run } = useSafeSave();
  const values = toHandValues(s);
  const setCard = (list: 'heroCards' | 'board', i: number, c: PartialCard) => set(list, s[list].map((x, j) => (j === i ? c : x)));

  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); if (values) void run(() => onSave(values)); }}>
      <label className={`field ${flagged.has('handId') || !s.handId.trim() ? 'flag' : ''}`}>
        <span>ID de la mano</span>
        <input aria-label="ID de la mano" value={s.handId} onChange={(e) => set('handId', e.target.value)} />
        {isSyntheticHandId(s.handId) && <small className="muted">La captura no trae ID, así que se generó uno a partir de la imagen para detectar repetidas.</small>}
      </label>
      <DateTimeField label="Fecha y hora" value={s.playedAt} onChange={(v) => set('playedAt', v)} flagged={flagged.has('playedAt')} />
      <label className={`field ${flagged.has('heroPosition') || !s.heroPosition ? 'flag' : ''}`}>
        <span>Posición</span>
        <select aria-label="Posición" value={s.heroPosition ?? ''} onChange={(e) => set('heroPosition', (e.target.value || null) as Position | null)}>
          <option value="">—</option>
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <div className="field">
        <span>Tus cartas</span>
        <div className="card-row">
          {s.heroCards.map((c, i) => (
            <CardPicker key={i} label={`Tu carta ${i + 1}`} value={c} flagged={flagged.has('heroCards')} onChange={(v) => setCard('heroCards', i, v)} />
          ))}
        </div>
      </div>
      <div className="field">
        <span>Tablero</span>
        <div className="card-row">
          {s.board.map((c, i) => (
            <CardPicker key={i} label={`Tablero ${i + 1}`} value={c} flagged={flagged.has('board')} onChange={(v) => setCard('board', i, v)} />
          ))}
          {s.board.length < 5 && <button type="button" className="btn" onClick={() => set('board', [...s.board, { rank: null, suit: null }])}>+ carta</button>}
          {s.board.length > 0 && <button type="button" className="btn" onClick={() => set('board', s.board.slice(0, -1))}>− carta</button>}
        </div>
      </div>
      <MoneyField label="Tu resultado ¥" value={s.heroResultCny} onChange={(v) => set('heroResultCny', v)} flagged={flagged.has('heroResultCny')} />
      <fieldset className="field">
        <legend>Tipo</legend>
        <label><input type="radio" checked={s.kind === 'allin'} onChange={() => set('kind', 'allin')} /> All-in propio (cuenta para EV)</label>
        <label><input type="radio" checked={s.kind === 'study'} onChange={() => set('kind', 'study')} /> Estudio</label>
      </fieldset>
      {s.kind === 'allin' && (
        <>
          <label className={`field ${s.allin.street === null ? 'flag' : ''}`}>
            <span>Calle del all-in</span>
            <select aria-label="Calle del all-in" value={s.allin.street ?? ''} onChange={(e) => setAllin({ street: (e.target.value || null) as Street | null })}>
              <option value="">—</option>
              {STREETS.map((st) => <option key={st} value={st}>{STREET_LABEL[st]}</option>)}
            </select>
          </label>
          <NumberField
            label="Tu equity %"
            value={s.allin.heroEquity === null ? null : Math.round(s.allin.heroEquity * 100)}
            onChange={(v) => setAllin({ heroEquity: v === null ? null : v / 100 })}
            integer
            flagged={flagged.has('allin')}
          />
          <NumberField label="Bote disputado ¥" value={s.allin.potContested} onChange={(v) => setAllin({ potContested: v })} flagged={flagged.has('allin')} />
          <NumberField label="Lo que pusiste ¥" value={s.allin.heroInvested} onChange={(v) => setAllin({ heroInvested: v })} flagged={flagged.has('allin')} />
          {values?.allin && <p className="muted">EV: {fmtCny(allinEv(values.allin))} · Suerte: {fmtCny(values.heroResultCny - allinEv(values.allin))}</p>}
        </>
      )}
      <label className="field">
        <span>Etiquetas (separadas por comas)</span>
        <input value={s.tags} onChange={(e) => set('tags', e.target.value)} />
      </label>
      <label className="field">
        <span>Notas</span>
        <textarea value={s.note} onChange={(e) => set('note', e.target.value)} rows={3} />
      </label>
      {error && <p role="alert" className="warning">{error}</p>}
      <div className="btn-row">
        <button type="submit" className="btn primary" disabled={!values || saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="btn" onClick={onCancel}>{cancelLabel}</button>
      </div>
    </form>
  );
}
