declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** JSON con la configuración web de Firebase. Si falta, la app funciona solo en local. */
  readonly VITE_FIREBASE_CONFIG?: string;
}
