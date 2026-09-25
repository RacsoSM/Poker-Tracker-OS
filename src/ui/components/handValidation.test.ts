import { describe, expect, it } from 'vitest';
import { emptyHandDraft } from '../../parsers/hand';
import { handStateFromDraft, toHandValues, type HandFormState } from './handValidation';

const complete: HandFormState = {
  handId: '1323539300829384704', playedAt: 1, heroPosition: 'BTN',
  heroCards: [{ rank: 'K', suit: 's' }, { rank: 'Q', suit: 's' }],
  board: [{ rank: '5', suit: 'c' }, { rank: 'Q', suit: 'd' }, { rank: '8', suit: 'h' }],
  heroResultCny: -156.1, kind: 'allin',
  allin: { street: 'flop', heroEquity: 0.13, potContested: 347.2, heroInvested: 156.1 },
  tags: ' cooler, flop ,', note: '',
};

describe('toHandValues', () => {
  it('convierte un estado completo', () => {
    expect(toHandValues(complete)).toEqual({
      handId: '1323539300829384704', playedAt: 1, heroPosition: 'BTN',
      heroCards: [{ rank: 'K', suit: 's' }, { rank: 'Q', suit: 's' }],
      board: [{ rank: '5', suit: 'c' }, { rank: 'Q', suit: 'd' }, { rank: '8', suit: 'h' }],
      heroResultCny: -156.1, kind: 'allin',
      allin: { street: 'flop', heroEquity: 0.13, potContested: 347.2, heroInvested: 156.1 },
      tags: ['cooler', 'flop'], note: undefined,
    });
  });
  it('estudio: descarta los datos de all-in', () => {
    expect(toHandValues({ ...complete, kind: 'study' })?.allin).toBeUndefined();
  });
  it('rechaza estados incompletos', () => {
    expect(toHandValues({ ...complete, handId: ' ' })).toBeNull();
    expect(toHandValues({ ...complete, heroPosition: null })).toBeNull();
    expect(toHandValues({ ...complete, heroCards: [{ rank: 'K', suit: null }, { rank: 'Q', suit: 's' }] })).toBeNull();
    expect(toHandValues({ ...complete, board: [{ rank: null, suit: 'c' }] })).toBeNull();
    expect(toHandValues({ ...complete, heroResultCny: null })).toBeNull();
    expect(toHandValues({ ...complete, allin: { ...complete.allin, heroEquity: null } })).toBeNull();
    expect(toHandValues({ ...complete, allin: { ...complete.allin, heroEquity: 1.2 } })).toBeNull();
  });
  it('rechaza cartas repetidas', () => {
    expect(toHandValues({ ...complete, board: [{ rank: 'K', suit: 's' }] })).toBeNull();
  });
  it('construye el estado desde un borrador vacío', () => {
    const s = handStateFromDraft(emptyHandDraft());
    expect(s.handId).toBe('');
    expect(s.allin).toEqual({ street: null, heroEquity: null, potContested: null, heroInvested: null });
  });
});
