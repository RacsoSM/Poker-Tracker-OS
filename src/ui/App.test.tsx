// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PtDb } from '../db/db';
import { DbProvider } from '../db/context';
import { App } from './App';

describe('App', () => {
  it('muestra la navegación inferior con las 4 pestañas', () => {
    render(<DbProvider db={new PtDb(`t-${crypto.randomUUID()}`)}><App /></DbProvider>);
    for (const label of ['Días', 'Gráficas', 'Manos', 'Ajustes']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Subir capturas' })).toBeInTheDocument();
  });
});
