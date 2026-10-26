import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useDb } from '../../db/context';
import { deleteHand, DuplicateHandError, setHandTag, updateHand } from '../../db/repo';
import { formatCard } from '../../domain/cards';
import { toLocalInput } from '../../domain/format';
import { allinEv, COOLER_TAG, handLuck, wentToShowdown, WELL_PLAYED_TAG } from '../../domain/stats';
import type { Hand } from '../../domain/types';
import { signClass } from '../format';
import { CardChip } from '../components/CardChip';
import { HandForm } from '../components/HandForm';
import type { HandListState } from '../components/HandRow';
import { handStateFromHand } from '../components/handValidation';
import { useStoredImageUrl } from '../hooks';
import { useMoney } from '../money';

const MARKS = [
  { tag: COOLER_TAG, cls: 'cooler', off: 'Marcar como cooler', on: '❄ Es un cooler' },
  { tag: WELL_PLAYED_TAG, cls: 'well-played', off: 'La volvería a jugar igual', on: '✓ La volvería a jugar igual' },
];
const MARK_TAGS = MARKS.map((m) => m.tag);

/** Anterior y siguiente en la lista de la que se vino; si se abrió directo, en orden cronológico entre todas las manos. */
function useHandOrder(): string[] | undefined {
  const db = useDb();
  const fromList = (useLocation().state as HandListState | null)?.ids;
  const all = useLiveQuery(async () => (fromList ? null : await db.hands.orderBy('playedAt').primaryKeys()), [db, fromList]);
  return fromList ?? all ?? undefined;
}

function HandNav({ id, ids }: { id: string; ids: string[] | undefined }) {
  const location = useLocation();
  if (!ids) return null;
  const i = ids.indexOf(id);
  if (i < 0 || ids.length < 2) return null;
  // `replace` para que "atrás" vuelva a la lista y no recorra mano por mano.
  const go = (to: string | undefined, label: string) =>
    to ? <Link className="btn" to={`/manos/${to}`} state={location.state} replace>{label}</Link> : <span className="btn" aria-disabled="true">{label}</span>;
  return (
    <nav className="hand-nav" aria-label="Navegar entre manos">
      {go(ids[i - 1], '← Anterior')}
      <span className="muted small">{i + 1} de {ids.length}</span>
      {go(ids[i + 1], 'Siguiente →')}
    </nav>
  );
}

function MarkButtons({ hand }: { hand: Hand }) {
  const db = useDb();
  return (
    <div className="btn-row">
      {MARKS.map((m) => {
        const on = hand.tags.includes(m.tag);
        return (
          <button key={m.tag} type="button" className={`btn mark-toggle ${m.cls}${on ? ' on' : ''}`} aria-pressed={on} onClick={() => void setHandTag(db, hand.id, m.tag, !on)}>
            {on ? m.on : m.off}
          </button>
        );
      })}
    </div>
  );
}

export function HandDetailPage() {
  const { id = '' } = useParams();
  const order = useHandOrder(); // aquí y no en el detalle, para que la barra no parpadee al cambiar de mano
  // `key`: al pasar a otra mano se empieza sin zoom ni edición abiertos.
  return <HandDetail key={id} id={id} order={order} />;
}

function HandDetail({ id, order }: { id: string; order: string[] | undefined }) {
  const db = useDb();
  const navigate = useNavigate();
  const { fmt } = useMoney();
  const hand = useLiveQuery(() => db.hands.get(id), [db, id]);
  const url = useStoredImageUrl(hand?.imageId);
  const [zoomed, setZoomed] = useState(false);
  const [editing, setEditing] = useState(false);
  if (hand === undefined) return <p className="muted page">Cargando…</p>;

  return (
    <section className="page">
      <h1>Mano {hand.handId}</h1>
      {url && (
        <>
          <div className={`zoom-wrap ${zoomed ? 'zoomed' : ''}`}>
            <img src={url} alt="Mano descargada" onClick={() => setZoomed(!zoomed)} />
          </div>
          <p className="muted small">Toca la imagen para hacer zoom.</p>
        </>
      )}
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
              <div className="muted small">{toLocalInput(hand.playedAt).replace('T', ' ')}{wentToShowdown(hand) && ' · Showdown'}</div>
            </div>
            <span className={signClass(hand.heroResultCny)}>{fmt(hand.heroResultCny)}</span>
          </div>
          {hand.kind === 'allin' && hand.allin && (
            <div className="notice">
              All-in en {hand.allin.street} con {Math.round(hand.allin.heroEquity * 100)}% · bote {fmt(hand.allin.potContested).replace('+', '')} · pusiste {fmt(hand.allin.heroInvested).replace('+', '')}
              <br />EV {fmt(allinEv(hand.allin))} · Suerte {fmt(handLuck(hand))}
            </div>
          )}
          <HandNav id={hand.id} ids={order} />
          <MarkButtons hand={hand} />
          {hand.tags.some((t) => !MARK_TAGS.includes(t)) && <p className="muted">Etiquetas: {hand.tags.filter((t) => !MARK_TAGS.includes(t)).join(', ')}</p>}
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
