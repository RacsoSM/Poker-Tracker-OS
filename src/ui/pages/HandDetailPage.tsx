import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDb } from '../../db/context';
import { deleteHand, DuplicateHandError, updateHand } from '../../db/repo';
import { formatCard } from '../../domain/cards';
import { fmtCny, toLocalInput } from '../../domain/format';
import { allinEv, handLuck } from '../../domain/stats';
import { signClass } from '../format';
import { CardChip } from '../components/CardChip';
import { HandForm } from '../components/HandForm';
import { handStateFromHand } from '../components/handValidation';
import { useStoredImageUrl } from '../hooks';

export function HandDetailPage() {
  const { id = '' } = useParams();
  const db = useDb();
  const navigate = useNavigate();
  const hand = useLiveQuery(() => db.hands.get(id), [db, id]);
  const url = useStoredImageUrl(hand?.imageId);
  const [zoomed, setZoomed] = useState(false);
  const [editing, setEditing] = useState(false);
  if (hand === undefined) return <p className="muted page">Cargando…</p>;

  return (
    <section className="page">
      <h1>Mano {hand.handId}</h1>
      {url && (
        <div className={`zoom-wrap ${zoomed ? 'zoomed' : ''}`}>
          <img src={url} alt="Mano descargada" onClick={() => setZoomed(!zoomed)} />
        </div>
      )}
      <p className="muted small">Toca la imagen para hacer zoom.</p>
      {editing ? (
        <HandForm
          initial={handStateFromHand(hand)}
          cancelLabel="Cancelar"
          onCancel={() => setEditing(false)}
          onSave={async (v) => {
            try {
              await updateHand(db, hand.id, v);
              setEditing(false);
            } catch (e) {
              if (e instanceof DuplicateHandError) window.alert('Ya existe otra mano con ese ID.');
              else throw e;
            }
          }}
        />
      ) : (
        <>
          <div className="list-item">
            <div className="grow">
              <div>{hand.heroCards.map((c) => <CardChip key={c.rank + c.suit} card={c} />)} · {hand.heroPosition}</div>
              <div className="muted small">Tablero: {hand.board.map(formatCard).join(' ') || '—'}</div>
              <div className="muted small">{toLocalInput(hand.playedAt).replace('T', ' ')}</div>
            </div>
            <span className={signClass(hand.heroResultCny)}>{fmtCny(hand.heroResultCny)}</span>
          </div>
          {hand.kind === 'allin' && hand.allin && (
            <div className="notice">
              All-in en {hand.allin.street} con {Math.round(hand.allin.heroEquity * 100)}% · bote {fmtCny(hand.allin.potContested).replace('+', '')} · pusiste {fmtCny(hand.allin.heroInvested).replace('+', '')}
              <br />EV {fmtCny(allinEv(hand.allin))} · Suerte {fmtCny(handLuck(hand))}
            </div>
          )}
          {hand.tags.length > 0 && <p className="muted">Etiquetas: {hand.tags.join(', ')}</p>}
          {hand.note && <p>{hand.note}</p>}
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setEditing(true)}>Editar</button>
            <button
              type="button"
              className="btn danger"
              onClick={async () => {
                if (!window.confirm('¿Borrar esta mano?')) return;
                await deleteHand(db, hand.id);
                navigate('/manos');
              }}
            >
              Borrar
            </button>
          </div>
        </>
      )}
    </section>
  );
}
