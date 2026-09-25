import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDb } from '../../db/context';
import { needsBackupReminder } from '../../domain/backupReminder';
import { aggregate, groupByDay, inRange, periodRange, playingDay, type Period } from '../../domain/stats';
import { DaysTable } from '../components/DaysTable';
import { PeriodFilter } from '../components/PeriodFilter';
import { useSettings } from '../hooks';

export function usePeriodData(period: Period) {
  const db = useDb();
  const settings = useSettings();
  const data = useLiveQuery(async () => ({ chunks: await db.chunks.toArray(), hands: await db.hands.toArray() }), [db]);
  if (!settings || !data) return undefined;
  const cutoff = settings.dayCutoffHour;
  const range = periodRange(period, playingDay(Date.now(), cutoff));
  return {
    settings,
    allChunks: data.chunks,
    allHands: data.hands,
    chunks: data.chunks.filter((c) => inRange(playingDay(c.startedAt, cutoff), range)),
    hands: data.hands.filter((h) => inRange(playingDay(h.playedAt, cutoff), range)),
  };
}

export function DaysPage() {
  const [period, setPeriod] = useState<Period>({ kind: 'month' });
  const d = usePeriodData(period);
  if (!d) return <p className="muted page">Cargando…</p>;
  const days = groupByDay(d.chunks, d.hands, d.settings.dayCutoffHour);
  const showBanner = needsBackupReminder(d.settings, d.allChunks.length + d.allHands.length, Date.now());
  return (
    <section className="page">
      <h1>Días</h1>
      {showBanner && (
        <p className="warning">
          Hace más de 7 días que no exportas una copia de seguridad. <Link to="/ajustes">Exportar ahora</Link>
        </p>
      )}
      <PeriodFilter value={period} onChange={setPeriod} />
      {days.length === 0 ? (
        <p className="muted">No hay datos en este periodo. Pulsa + para subir tus capturas.</p>
      ) : (
        <DaysTable days={days} total={aggregate(d.chunks, d.hands)} />
      )}
    </section>
  );
}
