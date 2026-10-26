import { fmtDuration, fmtNum, round2 } from '../../domain/format';
import type { Aggregate } from '../../domain/stats';
import { signClass } from '../format';
import { useMoney } from '../money';

export function StatCards({ stats }: { stats: Aggregate }) {
  const { fmt, symbol } = useMoney();
  const adjusted = round2(stats.resultCny - stats.luckCny);
  const withoutCoolers = round2(stats.resultCny - stats.coolerCny);
  const cards = [
    { label: 'Resultado', value: fmt(stats.resultCny), cls: signClass(stats.resultCny) },
    // Lo mismo que la línea naranja: el resultado con cada all-in cambiado por su EV.
    { label: 'Si fuera justo', value: stats.allins ? fmt(adjusted) : '—', cls: signClass(stats.allins ? adjusted : null) },
    { label: 'Manos', value: String(stats.hands), cls: '' },
    { label: 'Tiempo', value: fmtDuration(stats.durationSec), cls: '' },
    { label: `${symbol}/h`, value: stats.cnyPerHour === null ? '—' : fmt(stats.cnyPerHour), cls: signClass(stats.cnyPerHour) },
    { label: 'bb/100', value: fmtNum(stats.bbPer100, 2), cls: signClass(stats.bbPer100) },
    { label: 'Real − EV', value: stats.allins ? fmt(stats.luckCny) : '—', cls: signClass(stats.allins ? stats.luckCny : null) },
    // Las manos que marcaste como cooler: cuánto se fue en ellas y cómo queda el resultado sin ellas.
    { label: stats.coolers ? `Coolers (${stats.coolers})` : 'Coolers', value: stats.coolers ? fmt(stats.coolerCny) : '—', cls: signClass(stats.coolers ? stats.coolerCny : null) },
    { label: 'Sin coolers', value: stats.coolers ? fmt(withoutCoolers) : '—', cls: signClass(stats.coolers ? withoutCoolers : null) },
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
