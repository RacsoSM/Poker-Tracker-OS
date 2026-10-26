// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DbProvider } from '../../db/context';
import { PtDb } from '../../db/db';
import { addHand } from '../../db/repo';
import type { HandValues } from '../../domain/types';
import { HandDetailPage } from './HandDetailPage';

const HAND: HandValues = {
  handId: '1', playedAt: new Date(2026, 9, 25, 11).getTime(), heroPosition: 'HJ',
  heroCards: [{ rank: 'A', suit: 'd' }, { rank: '8', suit: 'c' }], board: [], heroResultCny: -28, kind: 'study', tags: [],
};

async function setup() {
  const db = new PtDb(`t-${crypto.randomUUID()}`);
  // Se guardan desordenadas: sin lista de origen, el orden es por hora de juego.
  const second = await addHand(db, { ...HAND, handId: '2', playedAt: HAND.playedAt + 60_000 });
  const first = await addHand(db, HAND);
  const third = await addHand(db, { ...HAND, handId: '3', playedAt: HAND.playedAt + 120_000 });
  render(
    <DbProvider db={db}>
      <MemoryRouter initialEntries={[`/manos/${second.id}`]}>
        <Routes><Route path="/manos/:id" element={<HandDetailPage />} /></Routes>
      </MemoryRouter>
    </DbProvider>,
  );
  return { db, first, second, third };
}

describe('HandDetailPage', () => {
  it('pasa a la mano anterior y a la siguiente', async () => {
    await setup();
    expect(await screen.findByText('2 de 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Siguiente →' }));
    expect(await screen.findByRole('heading', { name: 'Mano 3' })).toBeInTheDocument();
    expect(screen.getByText('3 de 3')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Siguiente →' })).toBeNull(); // es la última
    fireEvent.click(screen.getByRole('link', { name: '← Anterior' }));
    fireEvent.click(await screen.findByRole('link', { name: '← Anterior' }));
    expect(await screen.findByRole('heading', { name: 'Mano 1' })).toBeInTheDocument();
  });

  it('marca la mano como "la volvería a jugar igual" y como cooler, por separado', async () => {
    const { db, second } = await setup();
    fireEvent.click(await screen.findByRole('button', { name: 'La volvería a jugar igual' }));
    await waitFor(async () => expect((await db.hands.get(second.id))?.tags).toEqual(['bien jugada']));
    expect(await screen.findByRole('button', { name: '✓ La volvería a jugar igual' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como cooler' }));
    await waitFor(async () => expect((await db.hands.get(second.id))?.tags).toEqual(['bien jugada', 'cooler']));
    expect(screen.queryByText(/Etiquetas:/)).toBeNull(); // las marcas tienen su botón, no se repiten como etiquetas
  });
});
