import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VideoView, useVideoPlayer, type VideoSource, type SubtitleTrack } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Movie } from '../../src/types';
import { canStream, resumePosition, videoContentType } from '../../shared/domain.mjs';
import { replacePlaybackSource, type PlaybackIntent } from '../../shared/playback.mjs';
import { catalog } from './backend';
import { sourceFor, mediaError } from '../../shared/media.mjs';
import { fixtureQA, fixtureOwner } from './fixture-qa';
import { readDownloads } from './downloads';
import type { RootStack } from './navigation';
import { useStore } from './store';
import { Button, message } from './screens';
import { colors, styles as s } from './theme';

type Playback = { movie: Movie; uri: string; episodeId: string; offline: boolean; headers?: Record<string, string> };
export function PlayerScreen({ route }: NativeStackScreenProps<RootStack, 'Player'>) {
  const { session } = useStore();
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setPlayback(null); setError('');
    const load = async () => {
      if (route.params.offline) {
        if (!session && !fixtureQA) throw new Error('Sign in to play your downloads.');
        const entry = (await readDownloads(session?.user.id || fixtureOwner)).find(e => e.movie.id === route.params.id);
        if (!entry) throw new Error('The download is missing or has expired.');
        return { movie: entry.movie, uri: entry.uri, episodeId: '', offline: true };
      }
      const movie = await catalog.get(route.params.id);
      const source = sourceFor(movie, route.params.episodeId);
      return { movie: movie!, uri: source.uri, headers: source.headers, episodeId: route.params.episodeId || '', offline: false };
    };
    load().then(p => { if (active) setPlayback(p); }).catch(e => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, [route.params.id, route.params.episodeId, route.params.offline, session?.user.id, attempt]);
  if (error) return <View style={s.content}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button title="Retry playback" onPress={() => setAttempt(a => a + 1)} /></View>;
  if (!playback) return <View style={s.content}><ActivityIndicator color={colors.brand} /><Text style={s.muted}>Checking playback availability…</Text></View>;
  return <PlaybackView key={playback.uri} playback={playback} />;
}
function PlaybackView({ playback }: { playback: Playback }) {
  const { history, saveProgress, session, libraryError } = useStore();
  const [error, setError] = useState(''); const [status, setStatus] = useState('loading');
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [selectedSource, setSelectedSource] = useState({ label: 'Original', uri: playback.uri });
  const [replacing, setReplacing] = useState(false);
  const replacementActive = useRef(false); const replacementRequested = useRef(false);
  const retryIntent = useRef<PlaybackIntent | null>(null);
  const [position, setPosition] = useState(0); const [duration, setDuration] = useState(0);
  const resume = useRef(history.find(h => h.movie_id === playback.movie.id && h.episode_id === playback.episodeId));
  const latestProgress = useRef({ position: resume.current?.position ?? 0, duration: resume.current?.duration ?? 0 });
  const videoView = useRef<VideoView>(null);
  const initialized = useRef(false); const lastSync = useRef(0); const autoplay = useRef(false);
  const save = useRef(saveProgress); save.current = saveProgress;
  const source = (uri: string, headers = playback.headers): VideoSource => ({ uri, headers, contentType: playback.offline ? 'progressive' : videoContentType(uri) || 'auto', metadata: { title: playback.movie.title } });
  const player = useVideoPlayer(source(playback.uri), p => { p.timeUpdateEventInterval = 1; });
  const flush = () => {
    const progress = latestProgress.current;
    void save.current(playback.movie.id, playback.episodeId, progress.position, progress.duration);
  };
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('filimehome.autoplay').then(value => {
      if (!active) return;
      autoplay.current = value === 'true';
      if (autoplay.current && !replacementRequested.current && player.status === 'readyToPlay') player.play();
    }).catch(() => { /* Safe default: no autoplay. */ });
    const statusSubscription = player.addListener('statusChange', event => {
      setStatus(event.status);
      if (event.status === 'error') setError(mediaError(event.error?.message));
      if (event.status === 'readyToPlay') {
        setError(''); setDuration(player.duration);
        setSubtitles(player.availableSubtitleTracks);
        if (!initialized.current) {
          player.currentTime = resumePosition(latestProgress.current.position, player.duration);
          initialized.current = true;
          if (autoplay.current) player.play();
        }
      }
    });
    const timeSubscription = player.addListener('timeUpdate', event => {
      latestProgress.current = { position: event.currentTime, duration: player.duration };
      setPosition(event.currentTime); setDuration(player.duration);
      if (Date.now() - lastSync.current > 10000) { lastSync.current = Date.now(); flush(); }
    });
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        if (retryIntent.current) retryIntent.current.playing = false;
        player.pause(); flush();
      }
    });
    // A local file may already be ready before statusChange subscribes.
    if (player.status === 'readyToPlay') {
      player.currentTime = resumePosition(latestProgress.current.position, player.duration);
      initialized.current = true; setStatus('readyToPlay'); setDuration(player.duration); setSubtitles(player.availableSubtitleTracks);
    }
    return () => { active = false; flush(); statusSubscription.remove(); timeSubscription.remove(); appState.remove(); };
  }, [player]);
  const quality = async (label: string, uri: string) => {
    if (replacementActive.current) return;
    replacementActive.current = true; replacementRequested.current = true;
    setReplacing(true); setError(''); setStatus('loading');
    const intent = retryIntent.current || {
      position: initialized.current ? player.currentTime : resumePosition(latestProgress.current.position, player.duration),
      playing: player.playing,
    };
    retryIntent.current = intent;
    // Replacement owns seek and playback intent; initial-load autoplay must not
    // override a paused retry when the new source reports ready.
    initialized.current = true;
    try {
      let headers = playback.headers;
      if (!playback.offline) {
        const current = await catalog.get(playback.movie.id);
        const approved = sourceFor(current, playback.episodeId);
        if (label === 'Original' || playback.episodeId) uri = approved.uri;
        else {
          const alternative = current?.qualities?.find(q => q.label === label);
          if (!alternative) throw new Error('This quality is no longer available.');
          uri = sourceFor({ ...current!, video_url: alternative.url }).uri;
        }
        headers = approved.headers;
      }
      setSelectedSource({ label, uri });
      await replacePlaybackSource(player, source(uri, headers), intent);
      retryIntent.current = null; setStatus(player.status);
    } catch (e) { setError(mediaError(e)); setStatus('error'); }
    finally { replacementActive.current = false; setReplacing(false); }
  };
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <Text style={s.heading}>{playback.movie.title}</Text>
    <Text testID="playback-status" accessibilityLiveRegion="polite" style={s.muted}>{status === 'loading' ? 'Loading / buffering…' : status === 'readyToPlay' ? 'Ready to play' : status === 'error' ? 'Playback failed' : 'Preparing video…'}</Text>
    <VideoView ref={videoView} player={player} style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }} nativeControls allowsFullscreen allowsPictureInPicture
      onFullscreenEnter={() => { void ScreenOrientation.unlockAsync().catch(() => {}); }}
      onFullscreenExit={() => { void ScreenOrientation.unlockAsync().catch(() => {}); }} />
    {status === 'loading' && <ActivityIndicator color={colors.brand} />}
    {!!error && <><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button title="Reload video" disabled={replacing} onPress={() => void quality(selectedSource.label, selectedSource.uri)} /></>}
    <Text testID="playback-position" style={s.muted}>{Math.floor(position / 60)}:{String(Math.floor(position % 60)).padStart(2, '0')} / {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}</Text>
    <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Button title="−10 seconds" disabled={status !== 'readyToPlay' || replacing} onPress={() => { player.currentTime = Math.max(0, player.currentTime - 10); }} /></View><View style={{ flex: 1 }}><Bu…6741 tokens truncated…RootStack, 'Profile'>) {
  const { session, authReady, saved, history, libraryError } = useStore();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  useEffect(() => { setName(session?.user.user_metadata.display_name ?? ''); }, [session?.user.id]);
  const action = async (kind: 'login' | 'signup' | 'reset' | 'save' | 'logout') => {
    setBusy(true); setNotice('');
    try {
      const client = requireBackend();
      if (kind === 'logout') {
        if (session) await clearDownloads(session.user.id);
        const { error } = await client.auth.signOut(); if (error) throw error;
      } else if (kind === 'save' && session) {
        if (!name.trim() || name.length > 80) throw new Error('Enter a name of 1–80 characters.');
        const { error } = await client.auth.updateUser({ data: { display_name: name.trim() } }); if (error) throw error;
        const result = await client.from('profiles').upsert({ id: session.user.id, display_name: name.trim() }); if (result.error) throw result.error;
        setNotice('Profile saved.');
      } else {
        if (!email.includes('@')) throw new Error('Enter a valid email address.');
        if (kind === 'reset') {
          const { error } = await client.auth.resetPasswordForEmail(email.trim()); if (error) throw error;
          setNotice('If an account exists, a password reset email has been sent. Use the configured recovery website.');
        } else {
          if (password.length < 8) throw new Error('Use a password with at least eight characters.');
          const result = kind === 'login' ? await client.auth.signInWithPassword({ email: email.trim(), password }) : await client.auth.signUp({ email: email.trim(), password });
          if (result.error) throw result.error;
          setPassword(''); if (kind === 'signup' && !result.data.session) setNotice('Check your email to confirm your account, then sign in.');
        }
      }
    } catch (e) { setNotice(message(e)); } finally { setBusy(false); }
  };
  return <ScrollView style={s.screen} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <Text style={s.title}>Your profile</Text>{!authReady && <ActivityIndicator color={colors.brand} />}
    {!!notice && <Text accessibilityRole="alert" style={s.text}>{notice}</Text>}{!!libraryError && <Text style={s.error}>{libraryError}</Text>}
    {session ? <><Text style={s.muted}>{session.user.email}</Text><TextInput style={s.input} accessibilityLabel="Display name" value={name} onChangeText={setName} placeholder="Display name" placeholderTextColor={colors.muted} maxLength={80} />
      <Button title="Save profile" disabled={busy} onPress={() => void action('save')} /><Text style={s.muted}>{saved.length} saved titles · {history.length} playback records</Text>
      <Button title="Downloads" onPress={() => navigation.navigate('Downloads')} /><Button title="Settings" onPress={() => navigation.navigate('Settings')} />
      <Button title="Sign out and remove downloads" disabled={busy} onPress={() => void action('logout')} /></> : <>
      <Button title="Downloads" onPress={() => navigation.navigate('Downloads')} /><Button title="Settings" onPress={() => navigation.navigate('Settings')} /><Text style={s.muted}>Sign in to sync favorites, watchlists and playback progress.</Text>
      <TextInput accessibilityLabel="Email address" style={s.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="Email" placeholderTextColor={colors.muted} />
      <TextInput accessibilityLabel="Password" style={s.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="password" placeholder="Password" placeholderTextColor={colors.muted} />
      <Button title="Sign in" disabled={busy || !authReady} onPress={() => void action('login')} /><Button title="Create account" disabled={busy || !authReady} onPress={() => void action('signup')} /><Button title="Reset password" disabled={busy} onPress={() => void action('reset')} />
    </>}
  </ScrollView>;
}
export function DownloadsScreen({ navigation }: NativeStackScreenProps<RootStack, 'Downloads'>) {
  const { session } = useStore(); const jobs = useDownloadJobs(session?.user.id || (fixtureQA ? fixtureOwner : undefined)); const [entries, setEntries] = useState<Download[]>([]); const [error, setError] = useState('');
  const reload = React.useCallback(() => {
    if (!session && !fixtureQA) { setEntries([]); return; }
    setError(''); readDownloads(session?.user.id || fixtureOwner).then(setEntries).catch(e => setError(message(e)));
  }, [session?.user.id]);
  useFocusEffect(React.useCallback(() => { reload(); }, [reload]));
  useEffect(() => { reload(); }, [jobs.filter(job => job.status === 'complete').length, reload]);
  return <ScrollView style={s.screen} contentContainerStyle={s.content}><Text style={s.title}>Downloads</Text><Text style={s.muted}>Completed authorized MP4 files are available offline for up to seven days, or the earlier owner expiry. Signing out removes them. Paused transfers resume while the app stays open; after restarting, retry the download.</Text>
    {!!error && <Text style={s.error}>{error}</Text>}{!session && <Button title="Sign in" onPress={() => navigation.navigate('Profile')} />}
    {jobs.filter(job => job.status !== 'complete').map(job => <View key={job.id} style={s.card}><Text style={s.heading}>{job.title}</Text><DownloadControls job={job} /></View>)}
    {!entries.length && <Text style={s.muted}>No downloaded movies yet.</Text>}
    {entries.map(entry => <View key={entry.movie.id} style={s.card}><Text style={s.heading}>{entry.movie.title}</Text><Text style={s.muted}>Expires {new Date(entry.expiresAt).toLocaleDateString()}</Text>
      <Button title="Play offline" onPress={() => navigation.navigate('Player', { id: entry.movie.id, offline: true })} />
      <Button title="Remove" onPress={() => { if (session || fixtureQA) void removeDownload(session?.user.id || fixtureOwner, entry.movie.id).then(reload).catch(e => setError(message(e))); }} /></View>)}
  </ScrollView>;
}
export function SettingsScreen() {
  const [autoplay, setAutoplay] = useState(false); const [loaded, setLoaded] = useState(false); const [notice, setNotice] = useState('');
  useEffect(() => { AsyncStorage.getItem('filimehome.autoplay').then(v => { setAutoplay(v === 'true'); setLoaded(true); }).catch(e => setNotice(message(e))); }, []);
  return <ScrollView style={s.screen} contentContainerStyle={s.content}><Text style={s.title}>Settings</Text>
    <View style={s.card}><Text style={s.heading}>Autoplay when the player opens</Text><Switch accessibilityLabel="Autoplay" disabled={!loaded} value={autoplay} onValueChange={v => { setAutoplay(v); void AsyncStorage.setItem('filimehome.autoplay', String(v)).catch(e => setNotice(message(e))); }} trackColor={{ true: colors.brand }} /></View>
    <Text style={s.muted}>Video quality and embedded subtitles can be selected in the player when the source provides them. Downloads use device storage and may use mobile data.</Text><Text style={s.muted}>FilimeHome 2.0 · Android</Text>{!!notice && <Text style={s.error}>{notice}</Text>}
  </ScrollView>;
}
