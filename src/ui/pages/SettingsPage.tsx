import { useEffect, useState } from 'react';
import { BackupError, exportBackup, importBackup } from '../../db/backup';
import { useDb } from '../../db/context';
import { saveSettings } from '../../db/repo';
import { parseDecimal } from '../../domain/format';
import { dayKey } from '../../domain/stats';
import type { Settings } from '../../domain/types';
import { SyncSection } from '../components/SyncSection';
import { saveFile } from '../download';
import { useSettings } from '../hooks';
import { isPersisted } from '../storage';

function SettingsForm({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => Promise<void> }) {
  const [heroName, setHeroName] = useState(settings.heroName);
  const [sb, setSb] = useState(String(settings.stakes.sb));
  const [bb, setBb] = useState(String(settings.stakes.bb));
  const [straddle, setStraddle] = useState(String(settings.stakes.straddle));
  const [cutoff, setCutoff] = useState(String(settings.dayCutoffHour));
  const nums = { sb: parseDecimal(sb), bb: parseDecimal(bb), straddle: parseDecimal(straddle), cutoff: parseDecimal(cutoff) };
  const valid =
    heroName.trim() !== '' && nums.sb !== null && nums.bb !== null && nums.bb > 0 && nums.straddle !== null &&
    nums.cutoff !== null && Number.isInteger(nums.cutoff) && nums.cutoff <= 23;
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        void onSave({
          ...settings,
          heroName: heroName.trim(),
          stakes: { ...settings.stakes, sb: nums.sb!, bb: nums.bb!, straddle: nums.straddle! },
          dayCutoffHour: nums.cutoff!,
        });
      }}
    >
      <label className="field">
        <span>Nombre en la mesa</span>
        <input value={heroName} onChange={(e) => setHeroName(e.target.value)} autoComplete="off" />
      </label>
      <div className="row3">
        <label className="field"><span>SB ¥</span><input inputMode="decimal" value={sb} onChange={(e) => setSb(e.target.value)} /></label>
        <label className="field"><span>BB ¥</span><input inputMode="decimal" value={bb} onChange={(e) => setBb(e.target.value)} /></label>
        <label className="field"><span>Straddle ¥</span><input inputMode="decimal" value={straddle} onChange={(e) => setStraddle(e.target.value)} /></label>
      </div>
      <label className="field">
        <span>Hora de corte del día</span>
        <input inputMode="numeric" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
      </label>
      <button type="submit" className="btn primary" disabled={!valid}>Guardar ajustes</button>
    </form>
  );
}

export function SettingsPage() {
  const db = useDb();
  const settings = useSettings();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');

  useEffect(() => {
    void isPersisted().then(setPersisted);
  }, []);

  if (!settings) return <p className="muted page">Cargando…</p>;

  async function onExport() {
    const bytes = await exportBackup(db);
    saveFile(bytes, `poker-tracker-os-backup-${dayKey(new Date())}.zip`, 'application/zip');
    await saveSettings(db, { ...settings!, lastBackupAt: Date.now() });
    setMessage('Copia exportada. Guárdala en Drive o en otro lugar seguro.');
  }

  async function onImport(file: File) {
    if (mode === 'replace' && !window.confirm('Esto borrará todos tus datos actuales y los reemplazará por la copia. ¿Continuar?')) return;
    try {
      const r = await importBackup(db, new Uint8Array(await file.arrayBuffer()), mode);
      setMessage(`Importados ${r.chunks} tramos y ${r.hands} manos.`);
    } catch (e) {
      setMessage(e instanceof BackupError ? e.message : 'Error inesperado al importar la copia.');
    }
  }

  return (
    <section className="page">
      <h1>Ajustes</h1>
      {message && <p className="notice" role="status">{message}</p>}
      <SettingsForm key={JSON.stringify(settings)} settings={settings} onSave={async (s) => { await saveSettings(db, s); setMessage('Ajustes guardados.'); }} />

      <SyncSection />

      <h2>Copia de seguridad</h2>
      <p className="muted">
        Última copia: {settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString('es-MX') : 'nunca'}
      </p>
      <button type="button" className="btn primary" onClick={() => void onExport()}>Exportar copia</button>
      <fieldset className="field">
        <legend>Al importar</legend>
        <label><input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Fusionar con lo actual</label>
        <label><input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Reemplazar todo</label>
      </fieldset>
      <label className="btn">
        Importar copia…
        <input
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void onImport(f);
          }}
        />
      </label>

      <h2>Almacenamiento</h2>
      {persisted === false ? (
        <p className="warning">
          El navegador no garantizó el almacenamiento permanente: Android podría borrar tus datos si se queda sin espacio. Exporta copias con frecuencia.
        </p>
      ) : (
        <p className="muted">{persisted ? 'Almacenamiento permanente concedido.' : 'Estado de almacenamiento desconocido.'}</p>
      )}
      <p className="muted small">Poker Tracker-os v{__APP_VERSION__}</p>
    </section>
  );
}
