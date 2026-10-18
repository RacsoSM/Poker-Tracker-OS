// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_BUILD, VersionBadge } from './VersionBadge';

const published = (commit: string) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ version: '0.1.0', commit, builtAt: '2026-10-18T12:00:00Z' })));

afterEach(() => vi.restoreAllMocks());

describe('VersionBadge', () => {
  it('muestra la versión y el commit de este build', () => {
    published(CURRENT_BUILD.commit);
    render(<VersionBadge />);
    expect(screen.getByRole('button', { name: `v${CURRENT_BUILD.version} · ${CURRENT_BUILD.commit}` })).toBeInTheDocument();
  });

  it('al día: lo dice y ofrece buscar actualización', async () => {
    published(CURRENT_BUILD.commit);
    render(<VersionBadge />);
    await userEvent.click(screen.getByRole('button', { name: /^v/ }));
    expect(await screen.findByText('Estás en la última versión.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar actualización' })).toBeInTheDocument();
  });

  it('con otra versión publicada: avisa y ofrece actualizar', async () => {
    published('abc1234');
    render(<VersionBadge />);
    expect(await screen.findByLabelText('Hay una versión nueva')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^v/ }));
    expect(screen.getByText('v0.1.0 · abc1234')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar ahora' })).toBeInTheDocument();
  });

  it('sin conexión: no puede comprobarlo', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    render(<VersionBadge />);
    await userEvent.click(screen.getByRole('button', { name: /^v/ }));
    expect(await screen.findByText('No se pudo comprobar (¿sin conexión?)')).toBeInTheDocument();
  });
});
