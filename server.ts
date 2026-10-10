import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '24kb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
const auth = process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) : null;
const budgets = new Map<string, { count: number; reset: number }>();
app.use('/api', async (req, res, next) => {
  if (!auth) return res.status(503).json({ error: 'Backend is not configured' });
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'Sign in to use this service' });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid session' });
  const now = Date.now();
  for (const [key, budget] of budgets) if (budget.reset <= now) budgets.delete(key);
  const budget = budgets.get(data.user.id) ?? { count: 0, reset: now + 60000 };
  if (++budget.count > 10) return res.status(429).json({ error: 'Please try again in a minute' });
  budgets.set(data.user.id, budget);
  next();
});
// Private service keys stay on this server. Never use VITE_ or EXPO_PUBLIC_ for them.
app.post('/api/assistant', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'Assistant is not configured' });
  const messages = req.body?.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 10 ||
      messages.some(m => !['user', 'model'].includes(m?.role) || typeof m?.text !== 'string' || m.text.length > 2000)) {
    return res.status(400).json({ error: 'Invalid messages' });
  }
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
      config: { maxOutputTokens: 400, httpOptions: { timeout: 15000 },
        systemInstruction: 'You are the FilimeHome movie assistant. Do not claim movies are available to stream or provide unauthorized sources. Keep responses concise.' },
    });
    res.json({ text: response.text || 'No response was received.' });
  } catch { res.status(502).json({ error: 'Assistant service unavailable' }); }
});
app.get('/api/tmdb/:path(*)', async (req, res) => {
  if (!process.env.TMDB_API_KEY) return res.status(503).json({ error: 'Metadata service is not configured' });
  const tmdbPath = req.params.path;
  if (!/^(trending\/(movie|tv)\/(day|week)|search\/(movie|tv)|movie\/\d+|tv\/\d+)$/.test(tmdbPath)) {
    return res.status(400).json({ error: 'Unsupported metadata request' });
  }
  const query = new URLSearchParams();
  for (const key of ['query', 'page', 'language']) {
    const value = req.query[key];
    if (typeof value === 'string' && value.length <= 200) query.set(key, value);
  }
  query.set('api_key', process.env.TMDB_API_KEY);
  try {
    const response = await fetch('https://api.themoviedb.org/3/' + tmdbPath + '?' + query, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return res.status(502).json({ error: 'Metadata service unavailable' });
    res.json(await response.json());
  } catch { res.status(502).json({ error: 'Metadata service unavailable' }); }
});
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
}
start().catch(() => { console.error('Unable to start FilimeHome server'); process.exitCode = 1; });

