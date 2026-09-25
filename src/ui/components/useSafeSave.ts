import { useRef, useState } from 'react';

// Evita guardados dobles (doble toque) y convierte los fallos en un mensaje visible.
export function useSafeSave() {
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => void | Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(`No se pudo guardar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return { saving, error, run };
}
