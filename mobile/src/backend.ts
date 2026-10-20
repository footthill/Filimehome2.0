import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { catalogOptionsFor, createCatalog } from '../../shared/catalog';
import { withDeadline } from '../../shared/deadline';

import { fixtureQA, fixtureCatalog } from './fixture-qa';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = !fixtureQA && url && key ? createClient(url, key, {
  global: { fetch: (input, init) => withDeadline(signal => fetch(input, { ...init, signal: init?.signal || signal }), 15000, 'Backend request') },
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
}) : null;
export const catalog = fixtureQA ? fixtureCatalog : createCatalog(supabase, { ...catalogOptionsFor(url), mediaContract: process.env.EXPO_PUBLIC_MEDIA_CONTRACT === 'rights-v1' ? 'rights-v1' : undefined });
export function requireBackend() {
  if (!supabase) throw new Error('Supabase is not configured. See the mobile environment setup.');
  return supabase;
}
