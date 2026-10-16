/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** api = use the COIN API server; anything else = browser-only demo (localStorage) */
  readonly VITE_DATA_MODE?: string
  /** dev only: where Vite proxies /api */
  readonly VITE_API_PROXY?: string
  readonly VITE_SUPPLIER_PORTAL_URL?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
