import { useState } from 'react';
import { RANKS, SUIT_NAME, SUIT_SYMBOL, SUITS } from '../../domain/cards';
import type { PartialCard } from '../../parsers/hand';

export function CardPicker({ value, onChange, label, flagged }: { value: PartialCard; onChange: (c: PartialCard) => void; label: string; flagged?: boolean }) {
  const [open, setOpen] = useState(false);
  const complete = value.rank !== null && value.suit !== null;
  const text = `${value.rank === 'T' ? '10' : (value.rank ?? '?')}${value.suit ? SUIT_SYMBOL[value.suit] : '?'}`;
  return (
    <div className="card-picker">
      <button
        type="button"
        aria-label={label}
        className={`card-chip ${value.suit ?? ''} ${!complete || flagged ? 'flag' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        {text}
      </button>
      {open && (
        <div className="picker-pop" role="group" aria-label={`Elegir ${label}`}>
          <div className="picker-row">
            {RANKS.map((r) => (
              <button type="button" key={r} aria-label={r === 'T' ? '10' : r} aria-pressed={value.rank === r} onClick={() => onChange({ ...value, rank: r })}>
                {r === 'T' ? '10' : r}
              </button>
            ))}
          </div>
          <div className="picker-row">
            {SUITS.map((s) => (
              <button type="button" key={s} className={`suit ${s}`} aria-label={SUIT_NAME[s]} aria-pressed={value.suit === s} onClick={() => onChange({ ...value, suit: s })}>
                {SUIT_SYMBOL[s]}
              </button>
            ))}
          </div>
          <button type="button" className="btn" onClick={() => setOpen(false)}>Listo</button>
        </div>
      )}
    </div>
  );
}
