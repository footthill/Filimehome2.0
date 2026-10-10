import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { normalizeMovie, secureUrl } from '../../shared/domain.mjs';
import { validateMovieDraft } from '../../shared/admin.mjs';
import type { Movie } from '../types';

const empty = () => normalizeMovie({ type: 'movie' });
export function AdminView() {
  const [authorized, setAuthorized] = useState(false); const [checking, setChecking] = useState(true);
  const [movies, setMovies] = useState<Movie[]>([]); const [draft, setDraft] = useState<Movie>(empty);
  const [editing, setEditing] = useState(false); const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [episodes, setEpisodes] = useState('[]'); const [qualities, setQualities] = useState('[]'); const [subtitles, setSubtitles] = useState('[]');
  const load = async () => {
    if (!supabase) return;
    const rows: Movie[] = [];
    for (let from = 0; ; from += 200) {
      const result = await supabase.from('moviesv2').select('*').order('id').range(from, from + 199);
      if (result.error) throw result.error;
      rows.push(...(result.data ?? []).map(normalizeMovie));
      if (!result.data || result.data.length < 200) break;
    }
    setMovies(rows);
    const result = await supabase.from('categories').select('name').order('name');
    if (result.error) throw result.error;
    setCategories((result.data ?? []).map(c => c.name));
  };
  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let active = true;
    const check = async () => {
      const { data, error } = await supabase!.auth.getUser();
      if (!active) return;
      if (error) { setNotice(error.message); setChecking(false); return; }
      const admin = data.user?.app_metadata.role === 'admin'; setAuthorized(admin); setChecking(false);
      if (admin) try { await load(); } catch (e) { setNotice(e instanceof Error ? e.message : 'Catalog unavailable.'); }
    };
    void check();
    const { data } = supabase.auth.onAuthStateChange(() => { window.setTimeout(() => { if (active) void check(); }, 0); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  const select = (movie?: Movie) => {
    const next = movie || empty(); setDraft(next); setEditing(!!movie); setNotice('');
    setEpisodes(JSON.stringify(next.episodes, null, 2)); setQualities(JSON.stringify(next.qualities, null, 2)); setSubtitles(JSON.stringify(next.subtitles, null, 2));
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!supabase) return; setBusy(true); setNotice('');
    try {
      const valid = validateMovieDraft({ ...draft, episodes: JSON.parse(episodes), qualities: JSON.parse(qualities), subtitles: JSON.parse(subtitles) });
      const { id, ...payload } = valid;
      const row = { ...payload, modifiedAt: new Date().toISOString() };
      const insertRow = { ...row, ...(id ? { id } : {}) };
      const result = editing ? await supabase.from('moviesv2').update(row).eq('id', id) : await supabase.from('moviesv2').insert(insertRow);
      if (result.error) throw result.error;
      await load(); select(); setNotice('Movie saved.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Save failed.'); } finally { setBusy(false); }
  };
  const upload = async (file?: File) => {
    if (!file || !supabase) return;
    setBusy(true);
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Choose a JPG, PNG or WebP image under 10 MB.');
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const name = crypto.randomUUID() + '.' + extension;
      const { error } = await supabase.storage.from('filimehome-posters').upload(name, file, { contentType: file.type }); if (error) throw error;
      const url = secureUrl(supabase.storage.from('filimehome-posters').getPublicUrl(name).data.publicUrl);
      setDraft(previous => ({ ...previous, poster: url, image: previous.image || url })); setNotice('Poster uploaded. Save the movie to attach it.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Upload failed.'); } finally { setBusy(false); }
  };
  const category = async (name: string, remove = false) => {
    if (!supabase) return; setBusy(true);
    try {
      const value = name.trim(); if (!value || value.length > 80) throw new Error('Enter a category of 1–80 characters.');
      const result = remove ? await supabase.from('categories').delete().eq('name', value) : await supabase.from('categories').upsert({ name: value });
      if (result.error) throw result.error; setNewCategory(''); await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Category update failed.'); } finally { setBusy(false); }
  };
  if (checking) return <div className="p-12">Checking admin access…</div>;
  if (!authorized) return <div className="p-12 pb-32 space-y-4"><p>Administrator access is required.</p><Link to="/profile" className="text-brand">Sign in</Link>{notice && <p role="alert">{notice}</p>}</div>;
  const input = 'w-full p-3 rounded-xl bg-white/5 border border-white/10';
  return <div className="max-w-5xl mx-auto p-6 pb-32 space-y-8"><h1 className="text-3xl font-black italic">Manage FilimeHome</h1>
    <p className="text-white/60">Only publish content you have permission to distribute. Public poster and streaming URLs must be safe to share.</p>
    {notice && <p role="status" className="text-yellow-300">{notice}</p>}
    <div className="flex flex-wrap gap-3"><button onClick={() => select()} className="p-3 rounded-xl bg-brand">Add movie</button>{movies.map(movie => <button key={movie.id} onClick={() => select(movie)} className="p-3 glass rounded-xl">{movie.title} · {movie.published ? 'Published' : 'Draft'}</button>)}</div>
    <form onSubmit={save} className="grid sm:grid-cols-2 gap-5">
      <label>Movie ID (optional if database generates it)<input className={input} disabled={editing} value={draft.id} onChange={e => setDraft({ ...draft, id: e.target.value })} /></label>
      <label>Title<input className={input} required maxLength={200} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
      <label>Type<select className={input} value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as Movie['type'] })}><option value="movie">Movie</option><option value="tv">Series</option></select></label>
      {(['poster', 'image', 'video_url', 'download_url', 'release_date', 'narrator', 'country'] as const).map(field => <label key={field}>{field.replaceAll('_', ' ')}<input className={input} value={draft[field] || ''} onChange={e => setDraft({ ...draft, [field]: e.target.value })} /></label>)}
      <label>Poster upload<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => void upload(e.target.files?.[0])} /></label>
      <label>Description<textarea className={input} value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
      <label>Categories (comma separated)<input className={input} value={draft.genres.join(', ')} onChange={e => setDraft({ ...draft, genres: e.target.value.split(',').map(g => g.trim()).filter(Boolean) })} /></label>
      {(['published', 'featured', 'trending', 'streaming_authorized', 'offline_authorized'] as const).map(field => <label key={field} className="flex items-center gap-3"><input type="checkbox" checked={!!draft[field]} onChange={e => setDraft({ ...draft, [field]: e.target.checked })} />{field.replaceAll('_', ' ')}</label>)}
      <label>Episodes JSON<textarea className={input} rows={8} value={episodes} onChange={e => setEpisodes(e.target.value)} placeholder={'[{"id":"s1e1","title":"Episode title","season":1,"number":1,"video_url":"https://…","streaming_authorized":true}]'} /></label>
      <label>Quality variants JSON<textarea className={input} rows={5} value={qualities} onChange={e => setQualities(e.target.value)} placeholder={'[{"label":"720p","url":"https://…"}]'} /></label>
      <label>External subtitles JSON<textarea className={input} rows={5} value={subtitles} onChange={e => setSubtitles(e.target.value)} placeholder={'[{"label":"English","language":"en","url":"https://…/captions.vtt"}]'} /></label>
      <button disabled={busy} className="p-4 rounded-2xl bg-brand font-bold disabled:opacity-40" type="submit">{busy ? 'Working…' : 'Save movie'}</button>
    </form>
    <section className="space-y-4"><h2 className="text-xl font-bold">Categories</h2><div className="flex gap-3"><input aria-label="New category" className={input} value={newCategory} onChange={e => setNewCategory(e.target.value)} /><button disabled={busy} onClick={() => void category(newCategory)}>Add</button></div><div className="flex flex-wrap gap-3">{categories.map(name => <span key={name} className="p-3 glass rounded-xl">{name} <button disabled={busy} aria-label={'Delete category ' + name} onClick={() => void category(name, true)}>×</button></span>)}</div></section>
  </div>;
}
