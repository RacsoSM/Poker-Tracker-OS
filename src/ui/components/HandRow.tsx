import { Link } from 'react-router-dom';
import { formatCard } from '../../domain/cards';
import { fmtCny } from '../../domain/format';
import type { Hand } from '../../domain/types';
import { signClass } from '../format';
import { CardChip } from './CardChip';

export function HandRow({ hand }: { hand: Hand }) {
  return (
    <Link to={`/manos/${hand.id}`} className="hand-row">
      <span>{hand.heroCards.map((c) => <CardChip key={c.rank + c.suit} card={c} />)}</span>
      <span className="muted">{hand.heroPosition}</span>
      <span className="grow muted small">{hand.board.map(formatCard).join(' ')}</span>
      <span className={signClass(hand.heroResultCny)}>{fmtCny(hand.heroResultCny)}</span>
      <span className={`kind ${hand.kind}`}>{hand.kind === 'allin' ? 'All-in' : 'Estudio'}</span>
    </Link>
  );
}
