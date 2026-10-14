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
        const entry = (await readDownloads(session?.user.id || (fixtureQA ? fixtureOwner : 'device'))).find(e => e.movie.id === route.params.id);
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
    <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Button title="−10 seconds" disabled={status !== 'readyToPlay' || replacing} onPress={() => { player.currentTime = Math.max(0, player.currentTime - 10); }} /></View><View style={{ flex: 1 }}><Button title="+10 seconds" disabled={status !== 'readyToPlay' || replacing} onPress={() => { player.currentTime = Math.min(Math.max(0, player.duration - 0.1), player.currentTime + 10); }} /></View></View>
    <Button title="Play / Pause" disabled={status !== 'readyToPlay' || replacing} onPress={() => player.playing ? player.pause() : player.play()} />
    <Button title="Fullscreen" disabled={status !== 'readyToPlay'} onPress={() => { void videoView.current?.enterFullscreen().catch(e => setError(mediaError(e))); }} />
    {!session && <Text style={s.muted}>Sign in to save playback progress.</Text>}{!!libraryError && <Text style={s.error}>{libraryError}</Text>}
    {!playback.offline && !playback.episodeId && !!playback.movie.qualities?.length && <><Text style={s.heading}>Video quality · {selectedSource.label}</Text><Button title="Original / adaptive" disabled={replacing} onPress={() => void quality('Original', playback.uri)} />{playback.movie.qualities.map(q => <Button key={q.label} title={q.label} disabled={replacing} onPress={() => void quality(q.label, q.url)} />)}</>}
    {subtitles.length > 0 ? <><Text style={s.heading}>Subtitles</Text><Button title="Subtitles off" onPress={() => { player.subtitleTrack = null; }} />{subtitles.map(track => <Button key={track.id} title={track.label || track.language || 'Subtitle'} onPress={() => { player.subtitleTrack = track; }} />)}</> : <Text style={s.muted}>This source has no selectable embedded subtitles. Android supports subtitles provided by the stream; external subtitle files require packaging into HLS.</Text>}
  </ScrollView>;
}
