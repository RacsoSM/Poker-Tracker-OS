import { Link } from 'react-router-dom';
import { fmtCny, fmtDay, fmtDuration, fmtNum } from '../../domain/format';
import type { Aggregate, DayStats } from '../../domain/stats';
import { signClass } from '../format';

function StatCells({ s }: { s: Aggregate }) {
  return (
    <>
      <td>{s.chunks}</td>
      <td>{s.hands}</td>
      <td>{fmtDuration(s.durationSec)}</td>
      <td className={signClass(s.resultCny)}>{fmtCny(s.resultCny)}</td>
      <td className={signClass(s.cnyPerHour)}>{s.cnyPerHour === null ? '—' : fmtCny(s.cnyPerHour)}</td>
      <td className={signClass(s.bbPer100)}>{fmtNum(s.bbPer100, 2)}</td>
      <td>{s.allins}</td>
      <td className={signClass(s.allins ? s.luckCny : null)}>{s.allins ? fmtCny(s.luckCny) : '—'}</td>
    </>
  );
}

export function DaysTable({ days, total }: { days: DayStats[]; total: Aggregate }) {
  return (
    <div className="table-wrap">
      <table className="days-table">
        <thead>
          <tr>
            <th className="sticky">Fecha</th><th>Tramos</th><th>Manos</th><th>Tiempo</th><th>Resultado</th>
            <th>¥/h</th><th>bb/100</th><th>All-ins</th><th>Real − EV</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <td className="sticky"><Link to={`/dias/${d.day}`}>{fmtDay(d.day)}</Link></td>
              <StatCells s={d} />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="sticky">Total</td>
            <StatCells s={total} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
