/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MATCHMAKING_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
