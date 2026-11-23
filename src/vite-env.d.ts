/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** '1' = use the in-browser mock backend (tests only) */
  readonly VITE_CLOUD_MOCK?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
