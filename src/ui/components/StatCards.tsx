import { fmtDuration, fmtNum, round2 } from '../../domain/format';
import type { Aggregate } from '../../domain/stats';
import { signClass } from '../format';
import { useMoney } from '../money';

export function StatCards({ stats }: { stats: Aggregate }) {
  const { fmt, symbol } = useMoney();
  const adjusted = round2(stats.resultCny - stats.luckCny);
  const withoutCoolers = round2(stats.resultCny - stats.coolerCny);
  const marked = stats.coolers + stats.flips;
  const withoutCoolersOrFlips = round2(stats.resultCny - stats.coolerOrFlipCny);
  const cards = [
    { label: 'Resultado', value: fmt(stats.resultCny), cls: signClass(stats.resultCny) },
    // Lo mismo que la línea naranja: el resultado con cada all-in cambiado por su EV.
    { label: 'Si fuera justo', value: stats.allins ? fmt(adjusted) : '—', cls: signClass(stats.allins ? adjusted : null) },
    { label: 'Manos', value: String(stats.hands), cls: '' },
    { label: 'Tiempo', value: fmtDuration(stats.durationSec), cls: '' },
    { label: `${symbol}/h`, value: stats.cnyPerHour === null ? '—' : fmt(stats.cnyPerHour), cls: signClass(stats.cnyPerHour) },
    { label: 'bb/100', value: fmtNum(stats.bbPer100, 2), cls: signClass(stats.bbPer100) },
    { label: 'Real − EV', value: stats.allins ? fmt(stats.luckCny) : '—', cls: signClass(stats.allins ? stats.luckCny : null) },
    // Manos que volverías a jugar igual: lo que se fue (o se ganó) jugando bien.
    { label: stats.wellPlayed ? `Bien jugadas (${stats.wellPlayed})` : 'Bien jugadas', value: stats.wellPlayed ? fmt(stats.wellPlayedCny) : '—', cls: signClass(stats.wellPlayed ? stats.wellPlayedCny : null) },
    // Las manos que marcaste como cooler o flip: cuánto se fue en ellas y cómo queda el resultado sin ellas.
    { label: stats.coolers ? `Coolers (${stats.coolers})` : 'Coolers', value: stats.coolers ? fmt(stats.coolerCny) : '—', cls: signClass(stats.coolers ? stats.coolerCny : null) },
    { label: stats.flips ? `Flips (${stats.flips})` : 'Flips', value: stats.flips ? fmt(stats.flipCny) : '—', cls: signClass(stats.flips ? stats.flipCny : null) },
    { label: 'Sin coolers', value: stats.coolers ? fmt(withoutCoolers) : '—', cls: signClass(stats.coolers ? withoutCoolers : null) },
    { label: 'Sin coolers ni flips', value: marked ? fmt(withoutCoolersOrFlips) : '—', cls: signClass(marked ? withoutCoolersOrFlips : null) },
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
