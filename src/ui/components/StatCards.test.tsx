// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aggregate } from '../../domain/stats';
import { StatCards } from './StatCards';

const card = (label: string) => screen.getByText(label).nextElementSibling;

describe('StatCards', () => {
  it('ajustado a EV = resultado − (real − EV)', () => {
    const stats = { ...aggregate([], []), resultCny: 150, luckCny: 200, allins: 3 };
    render(<StatCards stats={stats} />);
    expect(card('Real − EV')).toHaveTextContent('+¥200.00');
    expect(card('Ajustado a EV')).toHaveTextContent('-¥50.00');
    expect(card('Ajustado a EV')).toHaveClass('neg');
  });
  it('sin all-ins no hay nada que ajustar', () => {
    render(<StatCards stats={{ ...aggregate([], []), resultCny: 150 }} />);
    expect(card('Ajustado a EV')).toHaveTextContent('—');
  });
});
