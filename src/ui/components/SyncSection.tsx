import { useState } from 'react';
import { signIn, signOut, syncNow, useSync } from '../../sync/runner';

const EMAIL_KEY = 'pt-sync-email';

export function SyncSection() {
  const sync = useSync();
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(EMAIL_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!sync.configured) return null;

  async function submit(create: boolean) {
    setBusy(true);
    const problem = await signIn(email.trim(), password, create);
    setError(problem);
    if (!problem) {
      try {
        localStorage.setItem(EMAIL_KEY, email.trim());
      } catch {
        // sin almacenamiento: simplemente no se recuerda el correo
      }
    }
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
        <form
          className="form"
          method="post"
          onSubmit={(e) => {
            e.preventDefault();
            // Ambos botones son "submit" para que el gestor de contraseñas del teléfono ofrezca guardar la cuenta.
            const create = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'create';
            void submit(create);
          }}
        >
          <p className="muted">Inicia sesión con la misma cuenta en cada dispositivo para ver tus manos y capturas en todos.</p>
          {error && <p className="warning" role="alert">{error}</p>}
          <label className="field">
            <span>Correo</span>
            <input id="email" name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <div className="btn-row">
            <button type="submit" value="login" className="btn primary" disabled={busy || !email || !password}>Iniciar sesión</button>
            <button type="submit" value="create" className="btn" disabled={busy || !email || !password}>Crear cuenta</button>
          </div>
        </form>
      )}
    </>
  );
}
