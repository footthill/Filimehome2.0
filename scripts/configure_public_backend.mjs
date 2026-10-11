import { readFile, appendFile } from 'node:fs/promises';
import { validatePublicConfig } from '../shared/public-config.mjs';

const verified = JSON.parse(await readFile(new URL('../config/supabase-public.json', import.meta.url), 'utf8'));
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const preferred = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const legacy = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
if (preferred && legacy && preferred !== legacy) throw new Error('Conflicting public Supabase key variables. Set one key or matching values.');
const key = preferred || legacy;
if (Boolean(url) !== Boolean(key)) throw new Error('Set both the public Supabase URL and key, or use the verified public repository configuration.');
const config = validatePublicConfig(url || verified.url, key || verified.publicKey);
if (!process.env.GITHUB_ENV) throw new Error('GITHUB_ENV is required; this script configures GitHub Actions builds.');
await appendFile(process.env.GITHUB_ENV, `EXPO_PUBLIC_SUPABASE_URL=${config.url}\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${config.key}\nEXPO_PUBLIC_SUPABASE_ANON_KEY=${config.key}\n`);
console.log(`::add-mask::${config.key}`);
console.log(`Configured ${config.url} with a validated ${config.kind} client key (${url ? 'repository variables' : 'verified live-website public configuration'}).`);
