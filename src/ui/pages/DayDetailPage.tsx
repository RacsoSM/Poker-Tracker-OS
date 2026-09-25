import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDb } from '../../db/context';
import { deleteChunk, updateChunk } from '../../db/repo';
import { fmtCny, fmtDay, fmtDuration, fmtTime } from '../../domain/format';
import { aggregate, playingDay } from '../../domain/stats';
import type { SessionChunk } from '../../domain/types';
import { signClass } from '../format';
import { HandRow } from '../components/HandRow';
import { ImageThumb } from '../components/ImageThumb';
import { StatCards } from '../components/StatCards';
import { SummaryForm } from '../components/SummaryForm';
import { useSettings, useStoredImageUrl } from '../hooks';

function ChunkItem({ chunk }: { chunk: SessionChunk }) {
  const db = useDb();
  const [editing, setEditing] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const url = useStoredImageUrl(showImage ? chunk.imageId : undefined);
  if (editing) {
    return (
      <SummaryForm
        initial={chunk}
        cancelLabel="Cancelar"
        onCancel={() => setEditing(false)}
        onSave={async (v) => { await updateChunk(db, chunk.id, v); setEditing(false); }}
      />
    );
  }
  return (
    <div className="list-item">
      <button type="button" className="btn" aria-label="Ver captura" onClick={() => setShowImage(!showImage)}><ImageThumb imageId={chunk.imageId} /></button>
      <div className="grow">
        <div>{fmtTime(chunk.startedAt)} · <span className={signClass(chunk.resultCny)}>{fmtCny(chunk.resultCny)}</span></div>
        <div className="muted small">{chunk.hands} manos · {fmtDuration(chunk.durationSec)}{chunk.note ? ` · ${chunk.note}` : ''}</div>
        {url && <img className="shot" src={url} alt="Captura del tramo" />}
      </div>
      <button type="button" className="btn" onClick={() => setEditing(true)}>Editar</button>
      <button type="button" className="btn danger" onClick={() => { if (window.confirm('¿Borrar este tramo?')) void deleteChunk(db, chunk.id); }}>Borrar</button>
    </div>
  );
}

export function DayDetailPage() {
  const { day = '' } = useParams();
  const db = useDb();
  const settings = useSettings();
  const data = useLiveQuery(async () => ({ chunks: await db.chunks.toArray(), hands: await db.hands.toArray() }), [db]);
  if (!settings || !data) return <p className="muted page">Cargando…</p>;
  const cutoff = settings.dayCutoffHour;
  const chunks = data.chunks.filter((c) => playingDay(c.startedAt, cutoff) === day).sort((a, b) => a.startedAt - b.startedAt);
  const hands = data.hands.filter((h) => playingDay(h.playedAt, cutoff) === day).sort((a, b) => a.playedAt - b.playedAt);
  return (
    <section className="page">
      <h1>{fmtDay(day)}</h1>
      <StatCards stats={aggregate(chunks, hands)} />
      <h2>Tramos ({chunks.length})</h2>
      <div className="list">{chunks.map((c) => <ChunkItem key={c.id} chunk={c} />)}</div>
      <h2>Manos ({hands.length})</h2>
      <div className="list">{hands.map((h) => <HandRow key={h.id} hand={h} />)}</div>
    </section>
  );
}
