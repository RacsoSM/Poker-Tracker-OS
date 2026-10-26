// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { aggregate, type DayStats } from '../../domain/stats';
import { DbProvider } from '../../db/context';
import { PtDb } from '../../db/db';
import { saveSettings } from '../../db/repo';
import { DEFAULT_SETTINGS, type Hand } from '../../domain/types';
import { MoneyProvider } from '../money';
import { DaysTable } from './DaysTable';

const chunk = { id: 'c', startedAt: 0, resultCny: -13, hands: 18, durationSec: 133, stakes: DEFAULT_SETTINGS.stakes, imageId: 'i', createdAt: 0 };

describe('DaysTable', () => {
  it('muestra una fila por día y la fila de totales', () => {
    const day: DayStats = { day: '2026-09-25', ...aggregate([chunk], []) };
    render(<MemoryRouter><DaysTable days={[day]} total={aggregate([chunk], [])} /></MemoryRouter>);
    const link = screen.getByRole('link', { name: '25/09/2026' });
    expect(link).toHaveAttribute('href', '/dias/2026-09-25');
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('-¥13.00')).toHaveClass('neg');
    expect(within(rows[1]).getByText('00:02:13')).toBeInTheDocument();
    expect(within(rows[1]).getByText('-36.11')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Total')).toBeInTheDocument();
  });

  it('muestra lo de los coolers y el resultado sin ellos; sin coolers, guiones', () => {
    const cooler: Hand = {
      id: 'h', handId: '1', playedAt: 0, heroPosition: 'BTN', heroCards: [{ rank: 'A', suit: 's' }, { rank: 'A', suit: 'd' }],
      board: [], heroResultCny: -200, kind: 'study', tags: ['cooler'], createdAt: 0,
    };
    const day: DayStats = { day: '2026-09-25', ...aggregate([{ ...chunk, resultCny: -250 }], [cooler]) };
    const empty: DayStats = { day: '2026-09-24', ...aggregate([chunk], []) };
    render(<MemoryRouter><DaysTable days={[day, empty]} total={aggregate([chunk], [])} /></MemoryRouter>);
    const head = within(screen.getAllByRole('row')[0]).getAllByRole('columnheader').map((th) => th.textContent);
    const cells = (row: number) => within(screen.getAllByRole('row')[row]).getAllByRole('cell');
    const col = (name: string) => head.indexOf(name);
    expect(cells(1)[col('Coolers')]).toHaveTextContent('-¥200.00');
    expect(cells(1)[col('Sin coolers')]).toHaveTextContent('-¥50.00');
    expect(cells(1)[col('Sin coolers')]).toHaveClass('neg');
    expect(cells(2)[col('Coolers')]).toHaveTextContent('—');
    expect(cells(2)[col('Sin coolers')]).toHaveTextContent('—');
  });

  it('en USD convierte los importes con el cambio de los ajustes; bb/100 no cambia', async () => {
    const db = new PtDb(`t-${crypto.randomUUID()}`);
    await saveSettings(db, { ...DEFAULT_SETTINGS, displayCurrency: 'USD', cnyPerUsd: 6.5 });
    const day: DayStats = { day: '2026-09-25', ...aggregate([chunk], []) };
    render(<DbProvider db={db}><MoneyProvider><MemoryRouter><DaysTable days={[day]} total={aggregate([chunk], [])} /></MemoryRouter></MoneyProvider></DbProvider>);
    const rows = screen.getAllByRole('row');
    expect(await within(rows[1]).findByText('-$2.00')).toHaveClass('neg');
    expect(within(rows[0]).getByText('$/h')).toBeInTheDocument();
    expect(within(rows[1]).getByText('-36.11')).toBeInTheDocument();
  });
});
