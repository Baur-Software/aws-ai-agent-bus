/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MCP_SERVER_URL?: string;
  readonly VITE_MCP_SERVER_PORT?: string;
  readonly VITE_DEV_MODE?: string;
  readonly VITE_APP_TITLE?: string;
  readonly VITE_API_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
