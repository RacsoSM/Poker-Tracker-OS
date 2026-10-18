import { useEffect, useState } from 'react';

export interface BuildInfo { version: string; commit: string; builtAt: string }

export const CURRENT_BUILD: BuildInfo = { version: __APP_VERSION__, commit: __APP_COMMIT__, builtAt: __APP_BUILT_AT__ };

type Remote = { state: 'checking' } | { state: 'offline' } | { state: 'ok'; build: BuildInfo };

// Pregunta qué versión hay publicada. Sin red (o en desarrollo, sin /version.json) no se sabe.
export async function fetchPublishedBuild(): Promise<BuildInfo | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const b = (await res.json()) as Partial<BuildInfo>;
    return typeof b.commit === 'string' && typeof b.version === 'string' ? (b as BuildInfo) : null;
  } catch {
    return null;
  }
}

const label = (b: BuildInfo) => `v${b.version} · ${b.commit}`;
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
};

// Trae el service worker nuevo y recarga: el nuevo hace skipWaiting y toma el control al instante.
async function updateNow() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
  } catch {
    // Sin service worker (navegador privado, desarrollo): basta con recargar.
  }
  window.location.reload();
}

// Arriba a la derecha: qué versión tienes y si hay otra publicada. Al tocarla, el detalle.
export function VersionBadge() {
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<Remote>({ state: 'checking' });
  const check = () => {
    setRemote({ state: 'checking' });
    void fetchPublishedBuild().then((b) => setRemote(b ? { state: 'ok', build: b } : { state: 'offline' }));
  };
  useEffect(check, []);
  const outdated = remote.state === 'ok' && remote.build.commit !== CURRENT_BUILD.commit;

  return (
    <div className="version">
      <button type="button" className={`version-badge${outdated ? ' outdated' : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label(CURRENT_BUILD)}
        {outdated && <span className="version-dot" aria-label="Hay una versión nueva" />}
      </button>
      {open && (
        <div className="version-panel" role="dialog" aria-label="Versión">
          <p>
            <span className="muted small">Tienes</span>
            <br />
            <strong>{label(CURRENT_BUILD)}</strong> <span className="muted small">({when(CURRENT_BUILD.builtAt)})</span>
          </p>
          <p>
            <span className="muted small">Publicada</span>
            <br />
            {remote.state === 'checking' && <span className="muted">Comprobando…</span>}
            {remote.state === 'offline' && <span className="muted">No se pudo comprobar (¿sin conexión?)</span>}
            {remote.state === 'ok' && (
              <>
                <strong>{label(remote.build)}</strong> <span className="muted small">({when(remote.build.builtAt)})</span>
              </>
            )}
          </p>
          {remote.state === 'ok' && !outdated && <p className="pos small">Estás en la última versión.</p>}
          <div className="version-actions">
            {outdated ? (
              <button type="button" className="btn primary" onClick={() => void updateNow()}>
                Actualizar ahora
              </button>
            ) : (
              <button type="button" className="btn" onClick={check} disabled={remote.state === 'checking'}>
                Buscar actualización
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
