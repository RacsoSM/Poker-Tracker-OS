import { useState } from 'react';
import { signIn, signOut, syncNow, useSync } from '../../sync/runner';

export function SyncSection() {
  const sync = useSync();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!sync.configured) return null;

  async function submit(create: boolean) {
    setBusy(true);
    setError(await signIn(email.trim(), password, create));
    setBusy(false);
  }

  return (
    <>
      <h2>Sincronización</h2>
      {sync.email ? (
        <>
          <p className="muted">
            Conectado como {sync.email}.{' '}
            {sync.status === 'syncing' ? 'Sincronizando…' : sync.lastSyncAt ? `Última sincronización: ${new Date(sync.lastSyncAt).toLocaleTimeString('es-MX')}.` : ''}
          </p>
          {sync.error && <p className="warning" role="alert">{sync.error}</p>}
          <div className="btn-row">
            <button type="button" className="btn primary" disabled={sync.status === 'syncing'} onClick={() => void syncNow()}>Sincronizar ahora</button>
            <button type="button" className="btn" onClick={() => void signOut()}>Cerrar sesión</button>
          </div>
        </>
      ) : (
        <form className="form" onSubmit={(e) => { e.preventDefault(); void submit(false); }}>
          <p className="muted">Inicia sesión con la misma cuenta en cada dispositivo para ver tus manos y capturas en todos.</p>
          {error && <p className="warning" role="alert">{error}</p>}
          <label className="field">
            <span>Correo</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <div className="btn-row">
            <button type="submit" className="btn primary" disabled={busy || !email || !password}>Iniciar sesión</button>
            <button type="button" className="btn" disabled={busy || !email || !password} onClick={() => void submit(true)}>Crear cuenta</button>
          </div>
        </form>
      )}
    </>
  );
}
