/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MATCHMAKING_URL?: string;
  readonly VITE_USE_WS_ROOM?: string | boolean;
  readonly VITE_PEERJS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
