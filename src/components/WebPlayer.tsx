import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Movie } from '../types';
import { catalog } from '../services/movieService';
import { canStream, resumePosition } from '../../shared/domain.mjs';
import { supabase } from '../lib/supabaseClient';

export function WebPlayer() {
  const { id } = useParams(); const ref = useRef<HTMLVideoElement>(null);
  const [movie, setMovie] = useState<Movie | null>(null); const [error, setError] = useState(''); const [source, setSource] = useState('');
  const progress = useRef({ position: 0, duration: 0 }); const resume = useRef(0); const uid = useRef<string | null>(null); const lastSync = useRef(0);
  const save = async () => {
    if (!supabase || !uid.current || !id || !Number.isFinite(progress.current.duration) || progress.current.duration <= 0) return;
    const { error } = await supabase.from('watch_history').upsert({ user_id: uid.current, movie_id: id, episode_id: '', ...progress.current, updated_at: new Date().toISOString() }, { onConflict: 'user_id,movie_id,episode_id' });
    if (error) setError('Playback progress could not sync: ' + error.message);
  };
  useEffect(() => {
    let active = true; setMovie(null); setError(''); resume.current = 0;
    const load = async () => {
      const movie = await catalog.get(id || '');
      if (!movie || !canStream(movie)) throw new Error('This movie is not available for streaming.');
      if (supabase) {
        const { data } = await supabase.auth.getSession(); uid.current = data.session?.user.id || null;
        if (uid.current) {
          const result = await supabase.from('watch_history').select('position').eq('user_id', uid.current).eq('movie_id', id).eq('episode_id', '').maybeSingle();
          if (result.data) resume.current = result.data.position;
        }
      }
      if (active) { setMovie(movie); setSource(movie.video_url); }
    };
    void load().catch(e => { if (active) setError(e instanceof Error ? e.message : 'Playback unavailable.'); });
    const onHidden = () => { if (document.hidden) { ref.current?.pause(); void save(); } };
    const onExit = () => { void save(); };
    document.addEventListener('visibilitychange', onHidden); window.addEventListener('pagehide', onExit);
    return () => { active = false; void save(); document.removeEventListener('visibilitychange', onHidden); window.removeEventListener('pagehide', onExit); };
  }, [id]);
  return <div className="max-w-5xl mx-auto p-6 pb-32 space-y-6"><Link to={'/movie/' + id} className="text-white/60">← Movie details</Link><h1 className="text-2xl font-black">{movie?.title || 'Movie player'}</h1>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {movie && <><video ref={ref} src={source} controls playsInline className="w-full rounded-2xl bg-black" crossOrigin="anonymous"
      onLoadedMetadata={() => { if (ref.current) ref.current.currentTime = resumePosition(resume.current, ref.current.duration); }}
      onTimeUpdate={() => { if (ref.current) { progress.current = { position: ref.current.currentTime, duration: ref.current.duration }; if (Date.now() - lastSync.current > 10000) { lastSync.current = Date.now(); void save(); } } }}
      onPause={() => void save()} onEnded={() => void save()}
      onError={() => setError('This browser could not play the source. Try the Android app for HLS, or choose a compatible MP4 quality.')}>
      {movie.subtitles?.map(sub => <track key={sub.language + sub.url} kind="subtitles" src={sub.url} srcLang={sub.language} label={sub.label} />)}
    </video>
    {!!movie.qualities?.length && <label>Quality<select className="ml-3 bg-neutral-900 p-3 rounded-xl" value={source} onChange={e => { resume.current = ref.current?.currentTime || 0; setSource(e.target.value); setError(''); }}><option value={movie.video_url}>Original / adaptive</option>{movie.qualities.map(q => <option key={q.url} value={q.url}>{q.label}</option>)}</select></label>}
    <p className="text-white/50">HLS requires native browser support. The Android app supports HLS through its native player. Subtitle files and video hosts must permit cross-origin requests.</p></>}
  </div>;
}
