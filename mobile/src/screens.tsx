import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import type { Movie } from '../../src/types';
import { canDownload, canStream, filterCatalog } from '../../shared/domain.mjs';
import { catalog, requireBackend } from './backend';
import { clearDownloads, downloadMovie, readDownloads, removeDownload, type Download } from './downloads';
import type { RootStack } from './navigation';
import { useStore } from './store';
import { colors, styles as s } from './theme';

type Navigation = NativeStackNavigationProp<RootStack>;
export const message = (error: unknown) => error instanceof Error ? error.message : 'The request failed. Please try again.';
export function Button({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, disabled && { opacity: 0.45 }]}><Text style={s.buttonText}>{title}</Text></Pressable>;
}
function Poster({ movie, width = 132 }: { movie: Movie; width?: number }) {
  const navigation = useNavigation<Navigation>();
  return <Pressable accessibilityRole="button" accessibilityLabel={'View ' + movie.title} onPress={() => navigation.navigate('Details', { id: movie.id })} style={{ width, gap: 8 }}>
    {movie.poster ? <Image source={{ uri: movie.poster }} style={{ width, height: width * 1.45, borderRadius: 18, backgroundColor: colors.surface }} /> : <View style={{ height: width * 1.45, backgroundColor: colors.surface, borderRadius: 18, justifyContent: 'center', padding: 15 }}><Text style={s.muted}>{movie.title}</Text></View>}
    <Text numberOfLines={2} style={{ color: colors.text, fontWeight: '700' }}>{movie.title}</Text>
    <Text style={{ color: colors.muted, fontSize: 12 }}>{movie.release_date} · {movie.type === 'tv' ? 'Series' : 'Movie'}</Text>
  </Pressable>;
}
function Row({ title, movies }: { title: string; movies: Movie[] }) {
  if (!movies.length) return null;
  return <View style={{ gap: 14 }}><Text style={[s.heading, { marginHorizontal: 20 }]}>{title}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>{movies.map(movie => <Poster key={movie.id} movie={movie} />)}</ScrollView></View>;
}
function CatalogStatus() {
  const { loading, error, movies, reload } = useStore();
  if (loading && !movies.length) return <View accessibilityLabel="Loading catalog" style={s.content}><ActivityIndicator color={colors.brand} /><View style={{ flexDirection: 'row', gap: 14 }}>{[1, 2, 3].map(i => <View key={i} style={{ flex: 1, height: 190, borderRadius: 18, backgroundColor: colors.surface }} />)}</View><Text style={s.muted}>Loading your movie catalog…</Text></View>;
  if (error) return <View style={s.card}><Text accessibilityRole="alert" style={s.error}>{error}</Text>{movies.length > 0 && <Text style={s.muted}>Showing saved catalog information.</Text>}<Button title="Retry" onPress={() => void reload()} /></View>;
  if (!movies.length) return <View style={s.content}><Text style={s.heading}>Your cinema starts here</Text><Text style={s.muted}>No titles have been published yet.</Text></View>;
  return null;
}
export function HomeScreen() {
  const { movies, history, saved, loading, reload, libraryError } = useStore();
  const navigation = useNavigation<Navigation>();
  const { width } = useWindowDimensions();
  const featured = movies.filter(m => m.featured).slice(0, 6);
  const banners = featured.length ? featured : movies.slice(0, 5);
  const likedGenres = new Set(movies.filter(m => saved.some(x => x.movie_id === m.id)).flatMap(m => m.genres));
  const recommended = [...movies].sort((a, b) => b.genres.filter(g => likedGenres.has(g)).length - a.genres.filter(g => likedGenres.has(g)).length).slice(0, 12);
  const latest = [...movies].sort((a, b) => b.release_date.localeCompare(a.release_date)).slice(0, 12);
  const continuing = history.filter(h => h.position > 0 && h.position < h.duration - 10);
  return <ScrollView style={s.screen} contentContainerStyle={{ gap: 28, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} tintColor={colors.brand} />}>
    <CatalogStatus />
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>{banners.map(movie => <Pressable key={movie.id} accessibilityRole="button" accessibilityLabel={'View ' + movie.title} onPress={() => navigation.navigate('Details', { id: movie.id })} style={{ width, height: Math.min(width * 1.15, 500) }}>
      {movie.image && <Image source={{ uri: movie.image }} style={{ position: 'absolute', width: '100%', height: '100%' }} />}
      <LinearGradient colors={['transparent', '#0e0e0e']} style={{ flex: 1, justifyContent: 'flex-end', padding: 24, gap: 12 }}>
        <Text style={{ color: colors.gold, fontWeight: '800', letterSpacing: 3 }}>FEATURED</Text><Text style={s.title}>{movie.title}</Text><Text style={s.muted}>{movie.genres.join(' · ')}</Text>
        <View style={[s.button, { alignSelf: 'flex-start', paddingHorizontal: 25 }]}><Text style={s.buttonText}>Explore title</Text></View>
      </LinearGradient>
    </Pressable>)}</ScrollView>
    {libraryError && <Text style={[s.error, { paddingHorizontal: 20 }]}>{libraryError}</Text>}
    {continuing.length > 0 && <View style={{ gap: 14, paddingHorizontal: 20 }}><Text style={s.heading}>Continue watching</Text>{continuing.slice(0, 5).map(h => {
      const movie = movies.find(m => m.id === h.movie_id);
      return movie ? <Pressable key={h.movie_id + h.episode_id} style={s.card} onPress={() => navigation.navigate('Player', { id: movie.id, episodeId: h.episode_id || undefined })}><Text style={s.text}>{movie.title}{h.episode_id ? ' · Episode' : ''}</Text><Text style={s.muted}>{Math.floor(h.position / 60)} / {Math.floor(h.duration / 60)} min</Text><View style={{ height: 3, backgroundColor: colors.border }}><View style={{ height: 3, width: `${Math.min(100, h.position / h.duration * 100)}%`, backgroundColor: colors.brand }} /></View></Pressable> : null;
    })}</View>}
    <Row title="Trending" movies={movies.filter(m => m.trending).slice(0, 12)} />
    <Row title="Latest releases" movies={latest} /><Row title="Recommended for you" movies={recommended} />
    <Row title="Series" movies={movies.filter(m => m.type === 'tv').slice(0, 12)} />
  </ScrollView>;
}
export function CatalogScreen({ type, search = false }: { type?: 'movie' | 'tv'; search?: boolean }) {
  const { movies, loading, reload } = useStore();
  const [query, setQuery] = useState(''); const [genre, setGenre] = useState('');
  const { width } = useWindowDimensions();
  const columns = width >= 600 ? 4 : 2;
  const results = filterCatalog(movies, query, genre, type);
  const categories = useMemo(() => [...new Set(movies.filter(m => !type || m.type === type).flatMap(m => m.genres))].sort(), [movies, type]);
  return <FlatList key={columns} style={s.screen} numColumns={columns} data={results} keyExtractor={m => m.id}
    contentContainerStyle={{ padding: 16, gap: 18 }} columnWrapperStyle={{ gap: 16 }}
    keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} tintColor={colors.brand} />}
    ListHeaderComponent={<View style={{ gap: 18, paddingBottom: 18 }}><Text style={s.title}>{search ? 'Explore' : type === 'tv' ? 'Series' : 'Movies'}</Text>
      <TextInput accessibilityLabel="Search movie catalog" placeholder="Titles, narrators, genres…" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={s.input} returnKeyType="search" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{['', ...categories].map(g => <Pressable key={g} style={[s.chip, genre === g && { borderColor: colors.brand }]} onPress={() => setGenre(g)}><Text style={s.text}>{g || 'All'}</Text></Pressable>)}</ScrollView><CatalogStatus /></View>}
    ListEmptyComponent={!loading ? <Text style={s.muted}>No matching titles. Try another search or category.</Text> : null}
    renderItem={({ item }) => <Poster movie={item} width={(width - 32 - 16 * (columns - 1)) / columns} />} />;
}
export function FavoritesScreen() {
  const { movies, saved, session, libraryError, reloadLibrary } = useStore();
  const navigation = useNavigation<Navigation>();
  const [kind, setKind] = useState<'favorite' | 'watchlist'>('favorite');
  const { width } = useWindowDimensions();
  useFocusEffect(React.useCallback(() => { void reloadLibrary(); }, [reloadLibrary]));
  const results = movies.filter(m => saved.some(x => x.movie_id === m.id && x.kind === kind));
  return <ScrollView style={s.screen} contentContainerStyle={s.content}><Text style={s.title}>Your collection</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>{(['favorite', 'watchlist'] as const).map(k => <Pressable key={k} style={[s.chip, kind === k && { borderColor: colors.brand }]} onPress={() => setKind(k)}><Text style={s.text}>{k === 'favorite' ? 'Favorites' : 'Watchlist'}</Text></Pressable>)}</View>
    {!session ? <Button title="Sign in to save movies" onPress={() => navigation.navigate('Profile')} /> : <>
      {!!libraryError && <Text style={s.error}>{libraryError}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>{results.map(m => <Poster key={m.id} movie={m} width={(width - 56) / 2} />)}</View>
      {!results.length && <Text style={s.muted}>Save a title from its details page to see it here.</Text>}</>}
  </ScrollView>;
}
export function DetailsScreen({ route, navigation }: NativeStackScreenProps<RootStack, 'Details'>) {
  const { movies, saved, toggleSaved, session } = useStore();
  const [movie, setMovie] = useState<Movie | null>(movies.find(m => m.id === route.params.id) ?? null);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0);
  useEffect(() => { let active = true;
    setLoading(true); setError('');
    catalog.get(route.params.id).then(m => { if (active) setMovie(m); }).catch(e => { if (active) setError(message(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [route.params.id]);
  const save = async (kind: 'favorite' | 'watchlist') => {
    if (!movie) return; setBusy(true);
    try { await toggleSaved(movie, kind); } catch (e) { Alert.alert('Unable to save', message(e)); } finally { setBusy(false); }
  };
  const download = async () => {
    if (!session || !movie) { navigation.navigate('Profile'); return; }
    setBusy(true); setProgress(0);
    try { await downloadMovie(session.user.id, movie, setProgress); Alert.alert('Download saved', 'Available in Downloads for seven days.'); }
    catch (e) { Alert.alert('Download failed', message(e)); } finally { setBusy(false); }
  };
  if (!movie) return <View style={s.content}>{loading ? <ActivityIndicator color={colors.brand} /> : <Text style={s.error}>{error || 'This title is not available.'}</Text>}</View>;
  return <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 30 }}>
    {movie.image && <Image source={{ uri: movie.image }} style={{ width: '100%', height: 270 }} />}
    <View style={s.content}><Text style={s.title}>{movie.title}</Text><Text style={s.muted}>{movie.release_date} · {movie.type === 'tv' ? 'Series' : 'Movie'} · {movie.genres.join(', ')}</Text>
      {!!error && <Text style={s.error}>{error}</Text>}{!!movie.description && <Text style={s.text}>{movie.description}</Text>}
      {!!movie.narrator && <Text style={s.muted}>Narrator: {movie.narrator}</Text>}
      <Button title="Watch now" disabled={loading || !!error || !canStream(movie)} onPress={() => navigation.navigate('Player', { id: movie.id })} />
      {!canStream(movie) && <Text style={s.muted}>Streaming is not available for this title.</Text>}
      <Button title={saved.some(x => x.movie_id === movie.id && x.kind === 'favorite') ? 'Remove favorite' : 'Add to favorites'} disabled={busy} onPress={() => void save('favorite')} />
      <Button title={saved.some(x => x.movie_id === movie.id && x.kind === 'watchlist') ? 'Remove from watchlist' : 'Add to watchlist'} disabled={busy} onPress={() => void save('watchlist')} />
      {canDownload(movie) && <Button title={busy ? `Downloading ${Math.round(progress * 100)}%` : 'Download authorized MP4'} disabled={busy || !!error} onPress={() => void download()} />}
      {!!movie.episodes?.length && <><Text style={s.heading}>Episodes</Text>{movie.episodes.map(e => <Button key={e.id} title={`S${e.season} E${e.number} · ${e.title}`} disabled={loading || !!error || !e.streaming_authorized || !e.video_url} onPress={() => navigation.navigate('Player', { id: movie.id, episodeId: e.id })} />)}</>}
    </View><Row title="More like this" movies={movies.filter(m => m.id !== movie.id && m.genres.some(g => movie.genres.includes(g))).slice(0, 12)} />
  </ScrollView>;
}
export function ProfileScreen({ navigation }: NativeStackScreenProps<RootStack, 'Profile'>) {
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
      <Text style={s.muted}>Sign in to sync favorites, watchlists and playback progress.</Text>
      <TextInput accessibilityLabel="Email address" style={s.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="Email" placeholderTextColor={colors.muted} />
      <TextInput accessibilityLabel="Password" style={s.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="password" placeholder="Password" placeholderTextColor={colors.muted} />
      <Button title="Sign in" disabled={busy || !authReady} onPress={() => void action('login')} /><Button title="Create account" disabled={busy || !authReady} onPress={() => void action('signup')} /><Button title="Reset password" disabled={busy} onPress={() => void action('reset')} />
    </>}
  </ScrollView>;
}
export function DownloadsScreen({ navigation }: NativeStackScreenProps<RootStack, 'Downloads'>) {
  const { session } = useStore(); const [entries, setEntries] = useState<Download[]>([]); const [error, setError] = useState('');
  const reload = React.useCallback(() => {
    if (!session) { setEntries([]); return; }
    readDownloads(session.user.id).then(setEntries).catch(e => setError(message(e)));
  }, [session?.user.id]);
  useFocusEffect(React.useCallback(() => { reload(); }, [reload]));
  return <ScrollView style={s.screen} contentContainerStyle={s.content}><Text style={s.title}>Downloads</Text><Text style={s.muted}>Authorized MP4 titles remain available for seven days. Signing out removes them.</Text>
    {!!error && <Text style={s.error}>{error}</Text>}{!session && <Button title="Sign in" onPress={() => navigation.navigate('Profile')} />}
    {!entries.length && <Text style={s.muted}>No downloaded movies yet.</Text>}
    {entries.map(entry => <View key={entry.movie.id} style={s.card}><Text style={s.heading}>{entry.movie.title}</Text><Text style={s.muted}>Expires {new Date(entry.expiresAt).toLocaleDateString()}</Text>
      <Button title="Play offline" onPress={() => navigation.navigate('Player', { id: entry.movie.id, offline: true })} />
      <Button title="Remove" onPress={() => { if (session) void removeDownload(session.user.id, entry.movie.id).then(reload).catch(e => setError(message(e))); }} /></View>)}
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
