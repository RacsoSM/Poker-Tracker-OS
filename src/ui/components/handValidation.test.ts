import { describe, expect, it } from 'vitest';
import { emptyHandDraft, type HandDraft } from '../../parsers/hand';
import { autoHandValues, handStateFromDraft, REVIEW_TAG, toHandValues, type HandFormState } from './handValidation';

const complete: HandFormState = {
  handId: '1323539300829384704', playedAt: 1, heroPosition: 'BTN',
  heroCards: [{ rank: 'K', suit: 's' }, { rank: 'Q', suit: 's' }],
  board: [{ rank: '5', suit: 'c' }, { rank: 'Q', suit: 'd' }, { rank: '8', suit: 'h' }],
  heroResultCny: -156.1, kind: 'allin',
  allin: { street: 'flop', heroEquity: 0.13, potContested: 347.2, heroInvested: 156.1 },
  showdown: false, tags: ' cooler, flop ,', note: '',
};

describe('toHandValues', () => {
  it('convierte un estado completo', () => {
    expect(toHandValues(complete)).toEqual({
      handId: '1323539300829384704', playedAt: 1, heroPosition: 'BTN',
      heroCards: [{ rank: 'K', suit: 's' }, { rank: 'Q', suit: 's' }],
      board: [{ rank: '5', suit: 'c' }, { rank: 'Q', suit: 'd' }, { rank: '8', suit: 'h' }],
      heroResultCny: -156.1, kind: 'allin',
      allin: { street: 'flop', heroEquity: 0.13, potContested: 347.2, heroInvested: 156.1 },
      showdown: true, tags: ['cooler', 'flop'], note: undefined,
    });
  });
  it('showdown: un all-in siempre cuenta; si no, manda la casilla', () => {
    expect(toHandValues({ ...complete, kind: 'study' })?.showdown).toBe(false);
    expect(toHandValues({ ...complete, kind: 'study', showdown: true })?.showdown).toBe(true);
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

describe('autoHandValues', () => {
  const read: HandDraft = {
    ...emptyHandDraft(), handId: 'img-0123456789abcdef', playedAt: 1, heroPosition: 'SB',
    heroCards: [{ rank: '7', suit: 's' }, { rank: '7', suit: 'c' }],
    board: [{ rank: 'Q', suit: 'c' }, { rank: '9', suit: 'd' }, { rank: '3', suit: 'd' }, { rank: '6', suit: 'c' }, { rank: 'J', suit: 'd' }],
    heroResultCny: -123, uncertain: [],
  };
  it('mano leída entera: lista para guardar sin formulario ni etiquetas', () => {
    expect(autoHandValues(read)).toMatchObject({ heroPosition: 'SB', heroResultCny: -123, kind: 'study', showdown: true, tags: [] });
  });
  it('con algún dato en duda: se guarda igual, con la etiqueta "revisar"', () => {
    expect(autoHandValues({ ...read, uncertain: ['allin'] })?.tags).toEqual([REVIEW_TAG]);
  });
  it('si falta un dato, no se puede guardar sola', () => {
    expect(autoHandValues({ ...read, heroResultCny: null })).toBeNull();
    expect(autoHandValues({ ...read, heroCards: [{ rank: null, suit: 's' }, { rank: '7', suit: 'c' }] })).toBeNull();
  });
});
