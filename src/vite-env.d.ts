declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
/** Fecha ISO del build. */
declare const __APP_BUILT_AT__: string;

interface ImportMetaEnv {
  /** JSON con la configuración web de Firebase. Si falta, la app funciona solo en local. */
  readonly VITE_FIREBASE_CONFIG?: string;
}
