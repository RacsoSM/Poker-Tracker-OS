import { fmtDuration, fmtNum } from '../../domain/format';
import type { Aggregate } from '../../domain/stats';
import { signClass } from '../format';
import { useMoney } from '../money';

export function StatCards({ stats }: { stats: Aggregate }) {
  const { fmt, symbol } = useMoney();
  const cards = [
    { label: 'Resultado', value: fmt(stats.resultCny), cls: signClass(stats.resultCny) },
    { label: 'Manos', value: String(stats.hands), cls: '' },
    { label: 'Tiempo', value: fmtDuration(stats.durationSec), cls: '' },
    { label: `${symbol}/h`, value: stats.cnyPerHour === null ? '—' : fmt(stats.cnyPerHour), cls: signClass(stats.cnyPerHour) },
    { label: 'bb/100', value: fmtNum(stats.bbPer100, 2), cls: signClass(stats.bbPer100) },
    { label: 'Real − EV', value: stats.allins ? fmt(stats.luckCny) : '—', cls: signClass(stats.allins ? stats.luckCny : null) },
  ];
  return (
    <div className="stat-cards">
      {cards.map((c) => (
        <div key={c.label} className="stat-card">
          <div className="label">{c.label}</div>
          <div className={`value ${c.cls}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
