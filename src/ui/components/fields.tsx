import { useState } from 'react';
import { fromLocalInput, parseDecimal, toLocalInput } from '../../domain/format';

const cls = (flagged: boolean | undefined, empty: boolean) => `field ${flagged || empty ? 'flag' : ''}`;

export function NumberField({ label, value, onChange, flagged, integer }: {
  label: string; value: number | null; onChange: (v: number | null) => void; flagged?: boolean; integer?: boolean;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  return (
    <label className={cls(flagged, value === null)}>
      <span>{label}</span>
      <input
        aria-label={label}
        inputMode={integer ? 'numeric' : 'decimal'}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseDecimal(e.target.value);
          onChange(v !== null && integer && !Number.isInteger(v) ? null : v);
        }}
      />
    </label>
  );
}

export function MoneyField({ label, value, onChange, flagged }: {
  label: string; value: number | null; onChange: (v: number | null) => void; flagged?: boolean;
}) {
  const [neg, setNeg] = useState(value !== null && value < 0);
  const [text, setText] = useState(value === null ? '' : Math.abs(value).toFixed(2));
  const emit = (t: string, n: boolean) => {
    const v = parseDecimal(t);
    onChange(v === null ? null : n ? -v : v);
  };
  return (
    <div className={cls(flagged, value === null)}>
      <span>{label}</span>
      <div className="money">
        <button type="button" className={`sign ${neg ? 'neg' : 'pos'}`} aria-label={`Cambiar signo de ${label}`} onClick={() => { setNeg(!neg); emit(text, !neg); }}>
          {neg ? '−' : '+'}
        </button>
        <input aria-label={label} inputMode="decimal" value={text} onChange={(e) => { setText(e.target.value); emit(e.target.value, neg); }} />
      </div>
    </div>
  );
}

export function DurationField({ value, onChange, flagged }: { value: number | null; onChange: (v: number | null) => void; flagged?: boolean }) {
  const init = value ?? 0;
  const [parts, setParts] = useState(
    value === null ? ['', '', ''] : [Math.floor(init / 3600), Math.floor((init % 3600) / 60), init % 60].map(String),
  );
  const labels = ['Horas', 'Minutos', 'Segundos'];
  const update = (i: number, t: string) => {
    const next = parts.map((p, j) => (j === i ? t : p));
    setParts(next);
    const [h, m, s] = next.map((p) => parseDecimal(p));
    const ok = [h, m, s].every((n) => n !== null && Number.isInteger(n)) && m! < 60 && s! < 60;
    onChange(ok ? h! * 3600 + m! * 60 + s! : null);
  };
  return (
    <div className={cls(flagged, value === null)}>
      <span>Duración (HH:MM:SS)</span>
      <div className="row3">
        {parts.map((p, i) => (
          <input key={labels[i]} aria-label={labels[i]} inputMode="numeric" value={p} onChange={(e) => update(i, e.target.value)} />
        ))}
      </div>
    </div>
  );
}

export function DateTimeField({ label, value, onChange, flagged }: {
  label: string; value: number | null; onChange: (v: number | null) => void; flagged?: boolean;
}) {
  return (
    <label className={cls(flagged, value === null)}>
      <span>{label}</span>
      <input aria-label={label} type="datetime-local" step={1} value={value === null ? '' : toLocalInput(value)} onChange={(e) => onChange(fromLocalInput(e.target.value))} />
    </label>
  );
}
