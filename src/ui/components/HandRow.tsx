import { Link } from 'react-router-dom';
import { formatCard } from '../../domain/cards';
import { isCooler, isFlip, isWellPlayed } from '../../domain/stats';
import type { Hand } from '../../domain/types';
import { signClass } from '../format';
import { useMoney } from '../money';
import { CardChip } from './CardChip';

/** Estado que la lista pasa al detalle para poder ir a la mano anterior o siguiente en el mismo orden. */
export interface HandListState { ids: string[] }

export function HandRow({ hand, list }: { hand: Hand; list?: string[] }) {
  const { fmt } = useMoney();
  return (
    <Link to={`/manos/${hand.id}`} state={list ? ({ ids: list } satisfies HandListState) : undefined} className="hand-row">
      <span>{hand.heroCards.map((c) => <CardChip key={c.rank + c.suit} card={c} />)}</span>
      <span className="muted">{hand.heroPosition}</span>
      <span className="grow muted small">{hand.board.map(formatCard).join(' ')}</span>
      {isCooler(hand) && <span className="kind cooler" title="Cooler" aria-label="Cooler">❄</span>}
      {isFlip(hand) && <span className="kind flip" title="Flip" aria-label="Flip">◐</span>}
      {isWellPlayed(hand) && <span className="kind well-played" title="La volvería a jugar igual" aria-label="Bien jugada">✓</span>}
      <span className={signClass(hand.heroResultCny)}>{fmt(hand.heroResultCny)}</span>
      <span className={`kind ${hand.kind}`}>{hand.kind === 'allin' ? 'All-in' : 'Estudio'}</span>
    </Link>
  );
}
