import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { catalogOptionsFor, createCatalog } from '../../shared/catalog';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
}) : null;
export const catalog = createCatalog(supabase, catalogOptionsFor(url));
export function requireBackend() {
  if (!supabase) throw new Error('Supabase is not configured. See the mobile environment setup.');
  return supabase;
}
