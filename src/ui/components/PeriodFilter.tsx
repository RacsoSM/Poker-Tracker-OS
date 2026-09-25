import type { Period } from '../../domain/stats';

const OPTIONS: { value: Period['kind']; label: string }[] = [
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
  { value: 'all', label: 'Todo' },
  { value: 'range', label: 'Rango…' },
];

export function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="filters">
      <label className="field">
        <span>Periodo</span>
        <select
          aria-label="Periodo"
          value={value.kind}
          onChange={(e) => {
            const kind = e.target.value as Period['kind'];
            onChange(kind === 'range' ? { kind, from: '2026-01-01', to: '2099-12-31' } : { kind });
          }}
        >
          {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      {value.kind === 'range' && (
        <>
          <label className="field"><span>Desde</span><input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} /></label>
          <label className="field"><span>Hasta</span><input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} /></label>
        </>
      )}
    </div>
  );
}
