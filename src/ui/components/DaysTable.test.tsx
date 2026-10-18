// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { aggregate, type DayStats } from '../../domain/stats';
import { DbProvider } from '../../db/context';
import { PtDb } from '../../db/db';
import { saveSettings } from '../../db/repo';
import { DEFAULT_SETTINGS } from '../../domain/types';
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
