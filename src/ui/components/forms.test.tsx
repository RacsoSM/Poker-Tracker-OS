// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PartialCard } from '../../parsers/hand';
import { CardPicker } from './CardPicker';
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
