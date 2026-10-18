// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PtDb } from '../../db/db';
import { DbProvider } from '../../db/context';
import { getSettings } from '../../db/repo';
import { SettingsPage } from './SettingsPage';

describe('SettingsPage', () => {
  it('guarda el nombre en mesa y la hora de corte', async () => {
    const db = new PtDb(`t-${crypto.randomUUID()}`);
    render(<DbProvider db={db}><MemoryRouter><SettingsPage /></MemoryRouter></DbProvider>);
    const name = await screen.findByLabelText('Nombre en la mesa');
    expect(name).toHaveValue('RacsoSM');
    await userEvent.clear(name);
    await userEvent.type(name, 'OscarOS');
    const cutoff = screen.getByLabelText('Hora de corte del día');
    await userEvent.clear(cutoff);
    await userEvent.type(cutoff, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ajustes' }));
    await waitFor(async () => {
      const s = await getSettings(db);
      expect(s.heroName).toBe('OscarOS');
      expect(s.dayCutoffHour).toBe(5);
    });
  });

  it('el interruptor de USD se guarda al momento, con el cambio editable', async () => {
    const db = new PtDb(`t-${crypto.randomUUID()}`);
    render(<DbProvider db={db}><MemoryRouter><SettingsPage /></MemoryRouter></DbProvider>);
    await userEvent.click(await screen.findByRole('switch', { name: 'Ver todo en dólares (USD)' }));
    await waitFor(async () => expect((await getSettings(db)).displayCurrency).toBe('USD'));
    const rate = await screen.findByLabelText('Yuanes por dólar (1 USD = … CNY)');
    expect(rate).toHaveValue('6.69');
    await userEvent.clear(rate);
    await userEvent.type(rate, '7.1');
    await waitFor(async () => expect((await getSettings(db)).cnyPerUsd).toBe(7.1));
  });
});
