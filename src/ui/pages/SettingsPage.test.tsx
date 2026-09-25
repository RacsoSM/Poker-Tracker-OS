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
});
