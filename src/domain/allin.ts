import { round2 } from './format';

export interface AllinInference { heroInvested: number; potContested: number; ambiguous: boolean }

// Spec §4.2: bote e inversión a partir de los resultados netos de la columna RIVER.
export function inferPot(heroResult: number, others: number[], equityPlayers: number): AllinInference {
  const losses = others.filter((r) => r < 0).map((r) => -r);
  const winners = others.filter((r) => r > 0);
  let heroInvested: number;
  let potContested: number;
  if (heroResult < 0) {
    heroInvested = -heroResult;
    potContested = heroInvested + Math.max(0, ...winners);
  } else {
    heroInvested = Math.max(0, ...losses);
    potContested = heroInvested + heroResult;
  }
  const positiveCount = winners.length + (heroResult > 0 ? 1 : 0);
  const ambiguous = equityPlayers > 2 || Math.abs(heroResult) < 0.005 || positiveCount > 1 || heroInvested === 0;
  return { heroInvested: round2(heroInvested), potContested: round2(potContested), ambiguous };
}
