/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MATCHMAKING_URL?: string;
  readonly VITE_USE_WS_ROOM?: string | boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
