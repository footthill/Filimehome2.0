/** Validate client credentials before embedding them. This does not verify RLS. */
export function validatePublicConfig(url, key) {
  if (typeof url !== 'string' || typeof key !== 'string' || !url || !key) throw new Error('Public Supabase URL and key are required.');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Invalid public Supabase URL.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash || !/^[a-z0-9]+\.supabase\.co$/.test(parsed.hostname)) {
    throw new Error('Use the HTTPS Supabase project URL without credentials or a path.');
  }
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return { url: parsed.origin, key, kind: 'publishable' };
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) throw new Error('Only a publishable key or legacy anon key may be embedded.');
  try {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let value = 0, bits = 0, decoded = '';
    for (const char of key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')) {
      value = (value << 6) | alphabet.indexOf(char); bits += 6;
      if (bits >= 8) { bits -= 8; decoded += String.fromCharCode((value >> bits) & 255); }
    }
    const payload = JSON.parse(decoded);
    if (payload.role !== 'anon' || payload.ref !== parsed.hostname.split('.')[0] || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) throw new Error('Invalid claims');
  } catch { throw new Error('Legacy client keys must have anon role, the matching project ref and a valid expiry.'); }
  return { url: parsed.origin, key, kind: 'legacy-anon' };
}
