import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import type { Movie } from '../../src/types';
import { catalog, requireBackend, supabase } from './backend';

export type History = { movie_id: string; episode_id: string; position: number; duration: number; updated_at: string };
export type Saved = { movie_id: string; kind: 'favorite' | 'watchlist' };
type Store = {
  movies: Movie[]; loading: boolean; error: string; session: Session | null; authReady: boolean;
  saved: Saved[]; history: History[]; libraryError: string;
  reload: () => Promise<void>; reloadLibrary: () => Promise<void>;
  toggleSaved: (movie: Movie, kind: Saved['kind']) => Promise<void>;
  saveProgress: (movieId: string, episodeId: string, position: number, duration: number) => Promise<void>;
};
const Context = createContext<Store | null>(null);
const catalogCache = 'filimehome.catalog.v2';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [libraryError, setLibraryError] = useState('');
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await catalog.list();
      setMovies(data);
      // Cache quota/write failures must not replace a successfully loaded catalog
      // with an older (or empty) snapshot in the network-error fallback below.
      try { await AsyncStorage.setItem(catalogCache, JSON.stringify(data)); }
      catch { /* Current network metadata remains usable without a disk cache. */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load movies');
      // Cached metadata lets authorized downloaded titles remain discoverable offline.
      try {
        const cached = JSON.parse(await AsyncStorage.getItem(catalogCache) || '[]');
        if (Array.isArray(cached)) setMovies(cached);
      } catch { /* Leave existing in-memory catalog available. */ }
    } finally { setLoading(false); }
  }, []);

  const reloadLibrary = useCallback(async () => {
    const uid = sessionRef.current?.user.id;
    if (!uid || !supabase) return;
    try {
      const [lists, progress] = await Promise.all([
        supabase.from('user_library').select('movie_id,kind').eq('user_id', uid),
        supabase.from('watch_history').select('movie_id,episode_id,position,duration,updated_at')
          .eq('user_id', uid).order('updated_at', { ascending: false }).limit(100),
      ]);
      if (lists.error) throw lists.error;
      if (progress.error) throw progress.error;
      if (sessionRef.current?.user.id !== uid) return;
      setSaved((lists.data ?? []).map(r => ({ movie_id: String(r.movie_id), kind: r.kind })));
      setHistory((progress.data ?? []).map(r => ({ ...r, movie_id: String(r.movie_id) })));
      setLibraryError('');
    } catch (e) {
      if (sessionRef.current?.user.id === uid) setLibraryError(e instanceof Error ? e.message : 'Unable to sync your library');
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const client = supabase;
    if (!client) { setAuthReady(true); return; }
    let active = true;
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (active) { sessionRef.current = next; setSession(next); setAuthReady(true); }
    });
    client.auth.getSession().then(({ data, error }) => {
      if (active) { sessionRef.current = data.session; setSession(data.session); setAuthReady(true); if (error) setLibraryError(error.message); }
    }).catch(() => { if (active) { setAuthReady(true); setLibraryError('Unable to restore session'); } });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') client.auth.startAutoRefresh(); else client.auth.stopAutoRefresh();
    });
    return () => { active = false; data.subscription.unsubscribe(); appState.remove(); client.auth.stopAutoRefresh(); };
  }, []);

  useEffect(() => {
    setSaved([]); setHistory([]); setLibraryError('');
    void reloadLibrary();
  }, [session?.user.id, reloadLibrary]);

  const toggleSaved = async (movie: Movie, kind: Saved['kind']) => {
    const uid = sessionRef.current?.user.id;
    if (!uid) throw new Error('Sign in from Profile to save titles.');
    const client = requireBackend();
    const exists = saved.some(s => s.movie_id === movie.id && s.kind === kind);
    const result = exists
      ? await client.from('user_library').delete().eq('user_id', uid).eq('movie_id', movie.id).eq('kind', kind)
      : await client.from('user_library').upsert({ user_id: uid, movie_id: movie.id, kind }, { onConflict: 'user_id,movie_id,kind' });
    if (result.error) throw new Error(result.error.message);
    await reloadLibrary();
  };
  const saveProgress = async (movieId: string, episodeId: string, position: number, duration: number) => {
    const uid = sessionRef.current?.user.id;
    if (!uid || !Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return;
    const row = { movie_id: movieId, episode_id: episodeId, position: Math.max(0, Math.min(position, duration)), duration, updated_at: new Date().toISOString() };
    const { error } = await requireBackend().from('watch_history').upsert({ user_id: uid, ...row }, { onConflict: 'user_id,movie_id,episode_id' });
    if (sessionRef.current?.user.id !== uid) return;
    if (error) { setLibraryError('Playback progress could not sync: ' + error.message); return; }
    setHistory(previous => [row, ...previous.filter(h => h.movie_id !== movieId || h.episode_id !== episodeId)]);
  };
  return <Context.Provider value={{ movies, loading, error, session, authReady, saved, history, libraryError, reload, reloadLibrary, toggleSaved, saveProgress }}>{children}</Context.Provider>;
}
export function useStore() {
  const context = useContext(Context);
  if (!context) throw new Error('StoreProvider is missing');
  return context;
}
