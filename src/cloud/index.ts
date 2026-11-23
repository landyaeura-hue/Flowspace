// Picks the cloud backend from build-time environment variables.
// No variables → local-only app (exactly the stage 1 behaviour, no account button).
import type { CloudBackend } from './backend';
import { SupabaseBackend } from './supabase-backend';
import { MemoryBackend } from './mock-backend';

function create(): CloudBackend | null {
  if (import.meta.env.VITE_CLOUD_MOCK === '1') return new MemoryBackend();
  const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) return new SupabaseBackend(url, key);
  return null;
}

export const backend = create();
