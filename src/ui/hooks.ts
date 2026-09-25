import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useDb } from '../db/context';
import { getSettings } from '../db/repo';
import type { Settings } from '../domain/types';
import { toBlob } from '../image/blob';

export function useSettings(): Settings | undefined {
  const db = useDb();
  return useLiveQuery(() => getSettings(db), [db]);
}

export function useObjectUrl(bytes?: Uint8Array, mime?: string): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!bytes) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(toBlob(bytes, mime ?? 'image/png'));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [bytes, mime]);
  return url;
}

export function useStoredImageUrl(imageId?: string): string | undefined {
  const db = useDb();
  const img = useLiveQuery(() => (imageId ? db.images.get(imageId) : undefined), [db, imageId]);
  return useObjectUrl(img?.bytes, img?.mime);
}
