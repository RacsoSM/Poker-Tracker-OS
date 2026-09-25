import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtCny, fmtDay } from '../../domain/format';
import { aggregate, allinSeries, cumulativeResult, groupByDay, type Period } from '../../domain/stats';
import { PeriodFilter } from '../components/PeriodFilter';
import { StatCards } from '../components/StatCards';
import { usePeriodData } from './DaysPage';

const axis = { stroke: 'var(--muted)', fontSize: 12 };
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' };
const money = (v: unknown) => fmtCny(Number(v));

export function ChartsPage() {
  const [period, setPeriod] = useState<Period>({ kind: 'month' });
  const d = usePeriodData(period);
  if (!d) return <p className="muted page">Cargando…</p>;
  const days = groupByDay(d.chunks, d.hands, d.settings.dayCutoffHour);
  const cum = cumulativeResult(days).map((p) => ({ ...p, label: fmtDay(p.day).slice(0, 5) }));
  const ev = allinSeries(d.hands);
  return (
    <section className="page">
      <h1>Gráficas</h1>
      <PeriodFilter value={period} onChange={setPeriod} />
      <StatCards stats={aggregate(d.chunks, d.hands)} />

      <h2>Resultado acumulado</h2>
      {cum.length === 0 ? (
        <p className="muted">Sin tramos en este periodo.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={cum} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} width={56} />
            <Tooltip contentStyle={tooltipStyle} formatter={money} />
            <Line type="monotone" dataKey="cum" name="Resultado" stroke="var(--accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}

      <h2>All-ins: real vs EV</h2>
      {ev.length <= 1 ? (
        <p className="muted">Todavía no hay all-ins registrados en este periodo.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={ev} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
            <XAxis dataKey="n" {...axis} />
            <YAxis {...axis} width={56} />
            <Tooltip contentStyle={tooltipStyle} formatter={money} labelFormatter={(n) => `All-in #${n}`} />
            <Legend />
            <Line type="monotone" dataKey="real" name="Real" stroke="var(--pos)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ev" name="EV" stroke="var(--flag)" strokeWidth={2} strokeDasharray="5 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
