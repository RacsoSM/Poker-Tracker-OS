import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { PtDb } from './db';

const DbContext = createContext<PtDb | null>(null);
let defaultDb: PtDb | null = null;

export function DbProvider({ db, children }: { db?: PtDb; children: ReactNode }) {
  const value = useMemo(() => db ?? (defaultDb ??= new PtDb()), [db]);
  return <DbContext.Provider value={value}>{children}</DbContext.Provider>;
}

export function useDb(): PtDb {
  const db = useContext(DbContext);
  if (!db) throw new Error('Falta DbProvider');
  return db;
}
