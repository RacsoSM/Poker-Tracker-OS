// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aggregate } from '../../domain/stats';
import { StatCards } from './StatCards';

const card = (label: string) => screen.getByText(label).nextElementSibling;

describe('StatCards', () => {
  it('si fuera justo = resultado − (real − EV)', () => {
    const stats = { ...aggregate([], []), resultCny: 150, luckCny: 200, allins: 3 };
    render(<StatCards stats={stats} />);
    expect(card('Real − EV')).toHaveTextContent('+¥200.00');
    expect(card('Si fuera justo')).toHaveTextContent('-¥50.00');
    expect(card('Si fuera justo')).toHaveClass('neg');
  });
  it('sin coolers = resultado − lo perdido en los coolers', () => {
    render(<StatCards stats={{ ...aggregate([], []), resultCny: -1600, coolers: 6, coolerCny: -1200 }} />);
    expect(card('Coolers (6)')).toHaveTextContent('-¥1200.00');
    expect(card('Sin coolers')).toHaveTextContent('-¥400.00');
  });
  it('sin coolers ni flips = resultado − lo de las manos con cualquiera de las dos marcas', () => {
    render(<StatCards stats={{ ...aggregate([], []), resultCny: -1600, coolers: 2, coolerCny: -900, flips: 3, flipCny: -500, coolerOrFlipCny: -1300 }} />);
    expect(card('Flips (3)')).toHaveTextContent('-¥500.00');
    expect(card('Sin coolers ni flips')).toHaveTextContent('-¥300.00');
  });
  it('sin all-ins no hay nada que ajustar', () => {
    render(<StatCards stats={{ ...aggregate([], []), resultCny: 150 }} />);
    expect(card('Si fuera justo')).toHaveTextContent('—');
  });
});
