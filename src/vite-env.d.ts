/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_REPLICATE_API_KEY: string
  readonly VITE_STRIPE_PRICE_SMALL: string
  readonly VITE_STRIPE_PRICE_MEDIUM: string
  readonly VITE_STRIPE_PRICE_LARGE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

