// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PartialCard } from '../../parsers/hand';
import { CardPicker } from './CardPicker';
import { HandForm } from './HandForm';
import { SummaryForm } from './SummaryForm';

function PickerHarness({ onChange }: { onChange: (c: PartialCard) => void }) {
  const [v, setV] = useState<PartialCard>({ rank: null, suit: null });
  return <CardPicker label="Carta 1" value={v} onChange={(c) => { setV(c); onChange(c); }} />;
}

describe('CardPicker', () => {
  it('elige rango y palo', async () => {
    const onChange = vi.fn();
    render(<PickerHarness onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Carta 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'A' }));
    await userEvent.click(screen.getByRole('button', { name: 'diamantes' }));
    expect(onChange).toHaveBeenLastCalledWith({ rank: 'A', suit: 'd' });
    expect(screen.getByRole('button', { name: 'Carta 1' })).toHaveTextContent('A♦');
  });
});

describe('SummaryForm', () => {
  it('no deja guardar hasta completar los campos y devuelve los valores', async () => {
    const onSave = vi.fn();
    render(
      <SummaryForm
        initial={{ startedAt: new Date(2026, 8, 25, 12).getTime(), resultCny: -13, hands: null, durationSec: 133 }}
        uncertain={['hands']}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    const save = screen.getByRole('button', { name: 'Guardar' });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Manos'), '18');
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledWith({ startedAt: new Date(2026, 8, 25, 12).getTime(), resultCny: -13, hands: 18, durationSec: 133, note: undefined });
  });
  it('el botón ± cambia el signo del resultado', async () => {
    const onSave = vi.fn();
    render(<SummaryForm initial={{ startedAt: 1, resultCny: 13, hands: 18, durationSec: 133 }} onSave={onSave} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar signo de Resultado ¥' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave.mock.calls[0][0].resultCny).toBe(-13);
  });
});

describe('guardado seguro', () => {
  const initial = { startedAt: 1, resultCny: -13, hands: 18, durationSec: 133 };

  it('un doble toque en Guardar solo guarda una vez', async () => {
    const onSave = vi.fn(() => new Promise<void>(() => {}));
    render(<SummaryForm initial={initial} onSave={onSave} onCancel={() => {}} />);
    const save = screen.getByRole('button', { name: 'Guardar' });
    await userEvent.click(save);
    await userEvent.click(screen.getByRole('button', { name: 'Guardando…' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });

  it('muestra el error si no se pudo guardar y permite reintentar', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('Disco lleno')).mockResolvedValueOnce(undefined);
    render(<SummaryForm initial={initial} onSave={onSave} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar: Disco lleno');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('HandForm: el campo de equity se marca en amarillo si el all-in es dudoso', () => {
    render(
      <HandForm
        initial={{
          handId: '1', playedAt: 1, heroPosition: 'BTN',
          heroCards: [{ rank: 'K', suit: 's' }, { rank: 'Q', suit: 's' }], board: [], heroResultCny: -156.1, kind: 'allin', showdown: true,
          allin: { street: 'flop', heroEquity: 0.03, potContested: 347.2, heroInvested: 156.1 }, tags: '', note: '',
        }}
        uncertain={['allin']}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Tu equity %' }).closest('label')).toHaveClass('flag');
  });
});
