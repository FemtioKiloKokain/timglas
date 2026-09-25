/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backendens bas-URL i split-deploy (t.ex. https://timglas.fly.dev). Tom = samma origin. */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
