import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Movie } from '../../src/types';
import { canDownload, canStream, filterCatalog } from '../../shared/domain.mjs';
import { sourceFor } from '../../shared/media.mjs';
import { catalog, requireBackend } from './backend';
import { clearDownloads, startDownload, downloadJobs, subscribeDownloads, pauseDownload, resumeDownload, cancelDownload, readDownloads, removeDownload, type Download, type DownloadJob } from './downloads';
import type { RootStack, TabStack } from './navigation';
import { fixtureQA, fixtureOwner } from './fixture-qa';
import { useStore } from './store';
import { colors, styles as s } from './theme';

type Navigation = NativeStackNavigationProp<RootStack>;
function useTabContentPadding() {
  const { bottom } = useSafeAreaInsets();
  return Math.max(112, Math.max(bottom, 12) + 64 + 24);
}
function useDownloadJobs(uid?: string) {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  useEffect(() => {
    const update = () => setJobs(uid ? downloadJobs(uid) : []);
    update(); return subscribeDownloads(update);
  }, [uid]);
  return jobs;
}
function DownloadControls({ job }: { job: DownloadJob }) {
  const report = (action: Promise<unknown>) => { void action.catch(error => Alert.alert('Download', message(error))); };
  return <View style={{ gap: 8 }}><Text testID="download-status" accessibilityLiveRegion="polite" style={s.muted}>{job.status === 'complete' ? 'Download complete' : job.status === 'error' ? job.error : job.status === 'canceled' ? 'Download canceled' : `${job.status} · ${Math.round(job.progress * 100)}%`}</Text>
    {job.status === 'downloading' && <Button title="Pause download" onPress={() => report(pauseDownload(job.uid, job.id))} />}
    {job.status === 'paused' && <Button title="Resume download" onPress={() => resumeDownload(job.uid, job.id)} />}
    {!['complete', 'error', 'canceled'].includes(job.status) && <Button secondary title="Cancel download" onPress={() => report(cancelDownload(job.uid, job.id))} />}
  </View>;
}
export const message = (error: unknown) => error instanceof Error ? error.message : 'The request failed. Please try again.';
export function Button({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, secondary && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, disabled && { opacity: 0.45 }]}><Text style={s.buttonText}>{title}</Text></Pressable>;
}
function Artwork({ uri, title, style }: { uri?: string; title: string; style: import('react-native').StyleProp<import('react-native').ImageStyle> }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [uri]);
  return uri && !failed ? <Image source={{ uri }} accessibilityLabel={title} resizeMode="cover" onError={() => setFailed(true)} style={style} />
    : <View style={[style, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="film-outline" color={colors.muted} size={32} /><Text numberOfLines={2} style={[s.muted, { padding: 12, textAlign: 'center' }]}>{title}</Text></View>;
}
const Poster = React.memo(function Poster({ movie, width = 112, variant = 'compact' }: { movie: Movie; width?: number; variant?: 'compact' | 'featured' | 'horizontal' }) {
  const navigation = useNavigation<Navigation>();
  const overlay = variant !== 'compact';
  const height = variant === 'horizontal' ? 190 : width * 4 / 3;
  return <Pressable accessibilityRole="button" accessibilityLabel={'View ' + movie.title} accessibilityHint="Opens title details" testID={'movie-card-' + movie.id} onPress={() => navigation.navigate('Details', { id: movie.id })} style={({ pressed }) => ({ width, gap: 8, opacity: pressed ? 0.8 : 1 })}>
    <View style={{ height, borderRadius: overlay ? 16 : 12, overflow: 'hidden', backgroundColor: colors.surface }}>
      <Artwork uri={variant === 'horizontal' ? movie.image || movie.poster : movie.poster} title={movie.title} style={{ width: '100%', height: '100%' }} />
      {overlay && <LinearGradient colors={['transparent', '#000000bb', '#000000ee']} style={{ position: 'absolute', inset: 0, justifyContent: 'flex-end', padding: 14, gap: 10 }}>
        <Text numberOfLines={2} style={{ color: colors.text, fontSize: variant === 'horizontal' ? 20 : 16, fontWeight: '700' }}>{movie.title}</Text>
        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 6, backgroundColor: '#fffffff0', paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8 }}><Ionicons name="play" size={12} color="#000" /><Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>View details</Text></View>
      </LinearGradient>}
    </View>
    {!overlay && <><Text numberOfLines={2} style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{movie.title}</Text><Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10 }}>{[movie.release_date, movie.narrator || (movie.type === 'tv' ? 'Series' : movie.type === 'movie' ? 'Movie' : 'Title')].filter(Boolean).join(' · ')}</Text></>}
  </Pressable>;
});
const Row = React.memo(function Row({ title, movies }: { title: string; movies: Movie[] }) {
  const { width } = useWindowDimensions();
  if (!movies.length) return null;
  const posterWidth = Math.max(96, Math.min(160, (width - 56) / (width >= 600 ? 4 : 3)));
  return <View style={{ gap: 14 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16 }}><Text style={[s.heading, { flexShrink: 1 }]}>{title}</Text><Ionicons name="chevron-forward" size={18} color={colors.gold} /></View><FlatList horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }} data={movies} keyExtractor={movie => movie.id} renderItem={({ item }) => <Poster movie={item} width={posterWidth} />} initialNumToRender={6} windowSize={5} /></View>;
});
function CatalogStatus() {
  const { loading, error, movies, reload } = useStore();
  if (loading && !movies.length) return <View accessibilityLabel="Loading catalog" style={s.content}><ActivityIndicator color={colors.brand} /><View style={{ flexDirection: 'row', gap: 14 }}>{[1, 2, 3].map(i => <View key={i} style={{ flex: 1, height: 190, borderRadius: 18, backgroundColor: colors.surface }} />)}</View><Text style={s.muted}>Loading your movie catalog…</Text></View>;
  if (error) return <View style={s.card}><Text accessibilityRole="alert" style={s.error}>{error}</Text>{movies.length > 0 && <Text style={s.muted}>Showing saved catalog information.</Text>}<Button title="Retry" onPress={() => void reload()} /></View>;
  if (!movies.length) return <View style={s.content}><Text style={s.heading}>Your cinema starts here</Text><Text style={s.muted}>No titles have been published yet.</Text></View>;
  return null;
}
export function HomeScreen() {
  const paddingBottom = useTabContentPadding();
  const { movies, history, saved, loading, reload, libraryError } = useStore();
  const navigation = useNavigation<Navigation>();
  const { width } = useWindowDimensions();
  const banners = useMemo(() => {
    const featured = movies.filter(m => m.featured).slice(0, 6);
    return featured.length ? featured : movies.slice(0, 5);
  }, [movies]);
  const likedGenres = useMemo(() => {
    const savedIds = new Set(saved.map(entry => entry.movie_id));
    return new Set(movies.filter(movie => savedIds.has(movie.id)).flatMap(movie => movie.genres));
  }, [movies, saved]);
  const recommended = useMemo(() => [...movies].sort((a, b) => b.genres.filter(g => likedGenres.has(g)).length - a.genres.filter(g => likedGenres.has(g)).length).slice(0, 12), [movies, likedGenres]);
  const latest = useMemo(() => [...movies].sort((a, b) => b.release_date.localeCompare(a.release_date)).slice(0, 12), [movies]);
  const trending = useMemo(() => movies.filter(m => m.trending).slice(0, 12), [movies]);
  const movieTitles = useMemo(() => movies.filter(m => m.type === 'movie').slice(0, 12), [movies]);
  const series = useMemo(() => movies.filter(m => m.type === 'tv').slice(0, 12), [movies]);
  const continuing = useMemo(() => history.filter(h => h.position > 0 && h.position < h.duration - 10), [history]);
  const cardWidth = (width - 44) / 2;
  return <ScrollView style={s.screen} contentContainerStyle={{ gap: 28, paddingTop: 16, paddingBottom }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} tintColor={colors.gold} />}>
    <View style={{ paddingHorizontal: 16 }}><WebsiteLinks /></View>
    <CatalogStatus />
    {!!banners.length && <View style={{ paddingHorizontal: 16, gap: 16 }}><View style={{ flexDirection: 'row', gap: 12 }}>{banners.slice(0, 2).map(movie => <Poster key={movie.id} movie={movie} width={cardWidth} variant="featured" />)}</View>{banners[2] && <Poster movie={banners[2]} width={width - 32} variant="horizontal" />}</View>}
    {libraryError && <Text style={[s.error, { paddingHorizontal: 16 }]}>{libraryError}</Text>}
    {continuing.length > 0 && <View style={{ gap: 14, paddingHorizontal: 16 }}><Text style={s.heading}>Continue watching</Text>{continuing.slice(0, 5).map(h => {
      const movie = movies.find(m => m.id === h.movie_id);
      return movie ? <Pressable accessibilityRole="button" accessibilityLabel={'Continue ' + movie.title} key={h.movie_id + h.episode_id} style={s.card} onPress={() => navigation.navigate('Player', { id: movie.id, episodeId: h.episode_id || undefined })}><Text style={s.text}>{movie.title}{h.episode_id ? ' · Episode' : ''}</Text><Text style={s.muted}>{Math.floor(h.position / 60)} / {Math.floor(h.duration / 60)} min</Text><View style={{ height: 3, backgroundColor: colors.border }}><View style={{ height: 3, width: `${Math.min(100, h.position / h.duration * 100)}%`, backgroundColor: colors.gold }} /></View></Pressable> : null;
    })}</View>}
    <Row title={trending.length ? 'Trending' : 'From the catalog'} movies={trending.length ? trending : movies.slice(0, 12)} />
    <Row title="Latest releases" movies={latest} /><Row title="Movies" movies={movieTitles} /><Row title="Series" movies={series} /><Row title="Recommended for you" movies={recommended} />
  </ScrollView>;
}
export function NarratorsScreen() {
  const paddingBottom = useTabContentPadding();
  const { movies, loading, reload } = useStore();
  const navigation = useNavigation<Navigation>();
  const narrators = useMemo(() => {
    const counts = new Map<string, number>();
    for (const movie of movies) if (movie.narrator.trim()) counts.set(movie.narrator, (counts.get(movie.narrator) || 0) + 1);
    return [...counts].sort(([a], [b]) => a.localeCompare(b));
  }, [movies]);
  return <FlatList style={s.screen} contentContainerStyle={[s.content, { paddingBottom }]} data={narrators} keyExtractor={([name]) => name} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} tintColor={colors.gold} />}
    ListHeaderComponent={<View style={{ gap: 16 }}><Text style={s.title}>Abasobanuzi</Text><Text style={s.muted}>Browse movies by narrator</Text><WebsiteLinks /><CatalogStatus /></View>}
    ListEmptyComponent={movies.length > 0 ? <Text style={s.muted}>No narrators are listed for these titles.</Text> : null}
    renderItem={({ item: [name, count] }) => <Pressable accessibilityRole="button" accessibilityLabel={'Browse ' + name} onPress={() => navigation.navigate('Main', { screen: 'Search', params: { narrator: name } })} style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}><Ionicons name="mic-outline" size={24} color={colors.brand} /><View style={{ flex: 1 }}><Text style={s.heading}>{name}</Text><Text style={s.muted}>{count} {count === 1 ? 'title' : 'titles'}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.gold} /></Pressable>} />;
}
function WebsiteLinks() {
  const open = (url: string) => { void Linking.openURL(url).catch(error => Alert.alert('Unable to open link', message(error))); };
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    <Pressable accessibilityRole="link" accessibilityLabel="No Ads" onPress={() => open('https://filimehome.com/subscription')} style={s.chip}><Text style={{ color: colors.gold, fontWeight: '700' }}>No Ads</Text></Pressable>
    <Pressable accessibilityRole="link" accessibilityLabel="WhatsApp" onPress={() => open("https://wa.me/250795566578?text=I%27m%20from%20FilimeHome")} style={s.chip}><Text style={{ color: colors.brand, fontWeight: '700' }}>WhatsApp</Text></Pressable>
  </View>;
}
function CatalogLinks() {
  const navigation = useNavigation<Navigation>();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['Search', 'Movies', 'Series'] as const).map(screen => <Pressable key={screen} accessibilityRole="button" onPress={() => navigation.navigate('Main', screen === 'Search' ? { screen: 'Search', params: { narrator: undefined } } : { screen })} style={s.chip}><Text style={{ color: colors.gold, fontWeight: '700' }}>{screen === 'Search' ? 'All titles' : screen}</Text></Pressable>)}</View>;
}
export function ExploreScreen({ route }: BottomTabScreenProps<TabStack, 'Search'>) {
  return <CatalogScreen search narrator={route.params?.narrator} />;
}
export function CatalogScreen({ type, search = false, narrator }: { type?: 'movie' | 'tv'; search?: boolean; narrator?: string }) {
  const paddingBottom = useTabContentPadding();
  const { movies, loading, reload } = useStore();
  const [query, setQuery] = useState(''); const [genre, setGenre] = useState('');
  const { width } = useWindowDimensions();
  const columns = width >= 600 ? 4 : 2;
  const results = useMemo(() => filterCatalog(movies, query, genre, type).filter(movie => !narrator || movie.narrator === narrator), [movies, query, genre, type, narrator]);
  const categories = useMemo(() => [...new Set(movies.filter(m => !type || m.type === type).flatMap(m => m.genres))].sort(), [movies, type]);
  const posterWidth = (width - 32 - 16 * (columns - 1)) / columns;
  const renderPoster = React.useCallback(({ item }: { item: Movie }) => <Poster movie={item} width={posterWidth} />, [posterWidth]);
  return <FlatList key={columns} testID="catalog-list" style={s.screen} numColumns={columns} data={results} keyExtractor={m => m.id}
    initialNumToRender={columns * 4} maxToRenderPerBatch={columns * 4} windowSize={7}
    contentContainerStyle={{ padding: 16, gap: 18, paddingBottom }} columnWrapperStyle={{ gap: 16 }}
    keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} tintColor={colors.brand} />}
    ListHeaderComponent={<View style={{ gap: 18, paddingBottom: 18 }}><Text style={s.title}>{search ? 'Explore' : type === 'tv' ? 'Series' : 'Movies'}</Text><CatalogLinks /><WebsiteLinks />{narrator && <View style={s.card}><Text style={s.text}>Narrator: {narrator}</Text><ClearNarrator /></View>}
      <TextInput testID="catalog-search-input" accessibilityLabel="Search movie catalog" placeholder="Titles, narrators, genres…" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={s.input} returnKeyType="search" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{['', ...categories].map(g => <Pressable key={g} accessibilityRole="button" accessibilityLabel={'Filter category ' + (g || 'All')} accessibilityState={{ selected: genre === g }} style={[s.chip, genre === g && { borderColor: colors.gold }]} onPress={() => setGenre(g)}><Text style={s.text}>{g || 'All'}</Text></Pressable>)}</ScrollView><CatalogStatus />
      {movies.length > 0 && <Text testID="catalog-result-count" accessibilityLiveRegion="polite" style={s.muted}>{results.length} {results.length === 1 ? 'title' : 'titles'}</Text>}
    </View>}
    ListEmptyComponent={!loading && movies.length > 0 ? <Text style={s.muted}>No matching titles. Try another search or category.</Text> : null}
    renderItem={renderPoster} />;
}
function ClearNarrator() {
  const navigation = useNavigation<Navigation>();
  return <Button title="Show all narrators" onPress={() => navigation.navigate('Main', { screen: 'Search', params: { narrator: undefined } })} />;
}
export function FavoritesScreen() {
  const paddingBottom = useTabContentPadding();
  const { movies, saved, session, libraryError, reloadLibrary, loading } = useStore();
  const navigation = useNavigation<Navigation>();
  const [kind, setKind] = useState<'favorite' | 'watchlist'>('favorite');
  const { width } = useWindowDimensions();
  useFocusEffect(React.useCallback(() => { void reloadLibrary(); }, [reloadLibrary]));
  const columns = width >= 600 ? 4 : 2;
  const results = useMemo(() => {
    const savedIds = new Set(saved.filter(entry => entry.kind === kind).map(entry => entry.movie_id));
    return movies.filter(movie => savedIds.has(movie.id));
  }, [movies, saved, kind]);
  const posterWidth = (width - 32 - 16 * (columns - 1)) / columns;
  const renderPoster = React.useCallback(({ item }: { item: Movie }) => <Poster movie={item} width={posterWidth} />, [posterWidth]);
  return <FlatList key={columns} testID="collection-list" style={s.screen} contentContainerStyle={[s.content, { paddingBottom }]}
    numColumns={columns} columnWrapperStyle={{ gap: 16 }} data={session ? results : []} keyExtractor={movie => movie.id}
    initialNumToRender={columns * 4} maxToRenderPerBatch={columns * 4} windowSize={7} renderItem={renderPoster}
    ListHeaderComponent={<View style={{ gap: 18 }}><Text style={s.title}>Your collection</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>{(['favorite', 'watchlist'] as const).map(k => <Pressable key={k} accessibilityRole="button" accessibilityLabel={k === 'favorite' ? 'Show favorites' : 'Show watchlist'} accessibilityState={{ selected: kind === k }} style={[s.chip, kind === k && { borderColor: colors.gold }]} onPress={() => setKind(k)}><Text style={s.text}>{k === 'favorite' ? 'Favorites' : 'Watchlist'}</Text></Pressable>)}</View>
      {!session ? <Button title="Sign in to save movies" onPress={() => navigation.navigate('Profile')} /> : <>
        {!!libraryError && <Text style={s.error}>{libraryError}</Text>}<CatalogStatus />
      </>}
    </View>}
    ListEmptyComponent={session && !loading && movies.length > 0 ? <Text style={s.muted}>Save a title from its details page to see it here.</Text> : null} />;
}
export function DetailsScreen({ route, navigation }: NativeStackScreenProps<RootStack, 'Details'>) {
  const { movies, saved, toggleSaved, session } = useStore();
  const { width } = useWindowDimensions();
  const [movie, setMovie] = useState<Movie | null>(movies.find(m => m.id === route.params.id) ?? null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const jobs = useDownloadJobs(session?.user.id || (fixtureQA ? fixtureOwner : undefined));
  const job = jobs.find(job => job.id === route.params.id);
  const downloading = !!job && !['error', 'canceled', 'complete'].includes(job.status);
  useEffect(() => { let active = true;
    setLoading(true); setError('');
    catalog.get(route.params.id).then(m => { if (active) setMovie(m); }).catch(e => { if (active) setError(message(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [route.params.id, attempt]);
  const save = async (kind: 'favorite' | 'watchlist') => {
    if (!movie) return; setBusy(true);
    try { await toggleSaved(movie, kind); } catch (e) { Alert.alert('Unable to save', message(e)); } finally { setBusy(false); }
  };
  const download = async () => {
    if ((!session && !fixtureQA) || !movie) { navigation.navigate('Profile'); return; }
    try { startDownload(session?.user.id || fixtureOwner, movie); }
    catch (e) { Alert.alert('Download failed', message(e)); }
  };
  if (!movie) return <View style={s.content}>{loading ? <ActivityIndicator color={colors.brand} /> : <><Text style={s.error}>{error || 'This title is not available.'}</Text><Button title="Retry movie details" onPress={() => setAttempt(value => value + 1)} /></>}</View>;
  return <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 30 }}>
    <View style={{ height: Math.min(width * 0.75, 380), backgroundColor: colors.surface }}><Artwork uri={movie.image || movie.poster} title={movie.title} style={{ width: '100%', height: '100%' }} /><LinearGradient colors={['transparent', '#00000077', colors.background]} style={{ position: 'absolute', inset: 0 }} /></View>
    <View style={[s.content, { marginTop: -64 }]}><View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}><Artwork uri={movie.poster} title={movie.title} style={{ width: 96, height: 128, borderRadius: 12 }} /><View style={{ flex: 1, gap: 10 }}><Text testID="movie-details-title" style={s.title}>{movie.title}</Text><Text style={s.muted}>{[movie.release_date, movie.type === 'tv' ? 'Series' : movie.type === 'movie' ? 'Movie' : 'Title'].filter(Boolean).join(' · ')}</Text></View></View>
      {!!movie.genres.length && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{movie.genres.map((genre, index) => <View key={genre + index} style={[s.chip, { paddingVertical: 6, paddingHorizontal: 10 }]}><Text style={{ color: colors.gold, fontSize: 12 }}>{genre}</Text></View>)}</View>}
      {loading && <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><ActivityIndicator color={colors.gold} /><Text style={s.muted}>Checking title availability…</Text></View>}{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!movie.description && <Text style={s.text}>{movie.description}</Text>}
      {!!movie.narrator && <Text style={s.muted}>Narrator: {movie.narrator}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel="Watch Now" accessibilityState={{ disabled: loading || !!error || !canStream(movie) }} disabled={loading || !!error || !canStream(movie)} onPress={() => navigation.navigate('Player', { id: movie.id })} style={[s.button, { flexDirection: 'row', gap: 8 }, (loading || !!error || !canStream(movie)) && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}><Ionicons name="play" size={20} color={canStream(movie) && !loading && !error ? colors.text : colors.muted} /><Text style={[s.buttonText, (loading || !!error || !canStream(movie)) && { color: colors.muted }]}>Watch Now</Text></Pressable>
      {(!!error || !!movie.media_availability_error) && <><Text accessibilityRole="alert" style={s.error}>{movie.media_availability_error}</Text><Button title="Retry movie details" disabled={loading} onPress={() => setAttempt(value => value + 1)} /></>}
      {!canStream(movie) && <Text style={s.muted}>Streaming is not available for this title. An authorized video source is required.</Text>}
      <Button secondary title={saved.some(x => x.movie_id === movie.id && x.kind === 'favorite') ? 'Remove favorite' : 'Add to favorites'} disabled={busy} onPress={() => void save('favorite')} />
      <Button secondary title={saved.some(x => x.movie_id === movie.id && x.kind === 'watchlist') ? 'Remove from watchlist' : 'Add to watchlist'} disabled={busy} onPress={() => void save('watchlist')} />
      {canDownload(movie) && <Button title="Download authorized MP4" disabled={loading || busy || downloading || !!error} onPress={() => void download()} />}
      {!canDownload(movie) && <Text style={s.muted}>Download unavailable: an authorized direct MP4 download source is required.</Text>}
      {job && <DownloadControls job={job} />}
      <Button secondary title="Downloads" onPress={() => navigation.navigate('Downloads')} />
      {!!movie.episodes?.length && <><Text style={s.heading}>Episodes</Text>{movie.episodes.map(e => <Button key={e.id} title={`S${e.season} E${e.number} · ${e.title}`} disabled={loading || !!error || (() => { try { sourceFor(movie, e.id); return false; } catch { return true; } })()} onPress={() => navigation.navigate('Player', { id: movie.id, episodeId: e.id })} />)}</>}
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
