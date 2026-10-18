import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { CNY_VIEW, currencySymbol, fmtMoney, round2, toView, type MoneyView } from '../domain/format';
import { useSettings } from './hooks';

// Moneda en que se enseñan los importes. Sin proveedor (o mientras cargan los ajustes), CNY.
const MoneyContext = createContext<MoneyView>(CNY_VIEW);

export function MoneyProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const currency = settings?.displayCurrency ?? 'CNY';
  const cnyPerUsd = settings?.cnyPerUsd ?? 1;
  const view = useMemo<MoneyView>(() => ({ currency, cnyPerUsd }), [currency, cnyPerUsd]);
  return <MoneyContext.Provider value={view}>{children}</MoneyContext.Provider>;
}

export function useMoney() {
  const view = useContext(MoneyContext);
  return useMemo(
    () => ({
      view,
      symbol: currencySymbol(view),
      /** Importe en CNY, formateado en la moneda elegida. */
      fmt: (cny: number) => fmtMoney(cny, view),
      /** Importe en CNY, convertido a la moneda elegida (para las gráficas). */
      conv: (cny: number) => round2(toView(cny, view)),
    }),
    [view],
  );
}
