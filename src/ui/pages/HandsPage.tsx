import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useDb } from '../../db/context';
import { allTags, filterHands } from '../../domain/handFilter';
import { periodRange, playingDay, type Period } from '../../domain/stats';
import { POSITIONS, type Position } from '../../domain/types';
import { HandRow } from '../components/HandRow';
import { PeriodFilter } from '../components/PeriodFilter';
import { useSettings } from '../hooks';

export function HandsPage() {
  const db = useDb();
  const settings = useSettings();
  const hands = useLiveQuery(() => db.hands.toArray(), [db]);
  const [kind, setKind] = useState<'all' | 'allin' | 'study'>('all');
  const [position, setPosition] = useState<Position | 'all'>('all');
  const [tag, setTag] = useState('all');
  const [period, setPeriod] = useState<Period>({ kind: 'all' });
  if (!settings || !hands) return <p className="muted page">Cargando…</p>;
  const range = periodRange(period, playingDay(Date.now(), settings.dayCutoffHour));
  const list = filterHands(hands, { kind, position, tag, range }, settings.dayCutoffHour);
  return (
    <section className="page">
      <h1>Manos</h1>
      <div className="filters">
        <label className="field">
          <span>Tipo</span>
          <select aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="all">Todas</option>
            <option value="allin">All-in propio</option>
            <option value="study">Estudio</option>
          </select>
        </label>
        <label className="field">
          <span>Posición</span>
          <select aria-label="Posición" value={position} onChange={(e) => setPosition(e.target.value as Position | 'all')}>
            <option value="all">Todas</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Etiqueta</span>
          <select aria-label="Etiqueta" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="all">Todas</option>
            {allTags(hands).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <PeriodFilter value={period} onChange={setPeriod} />
      <p className="muted small">{list.length} manos</p>
      <div className="list">{list.map((h) => <HandRow key={h.id} hand={h} />)}</div>
    </section>
  );
}
