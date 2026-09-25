import { formatCard } from '../../domain/cards';
import type { Card } from '../../domain/types';

export function CardChip({ card }: { card: Card }) {
  return <span className={`card-mini suit ${card.suit}`}>{formatCard(card)}</span>;
}
