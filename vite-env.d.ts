/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PARTYKIT_HOST?: string
  // add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}