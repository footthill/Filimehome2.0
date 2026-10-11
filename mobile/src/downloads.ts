import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { Movie } from '../../src/types';
import { canDownload } from '../../shared/domain.mjs';
import { catalog } from './backend';

export type Download = { movie: Movie; uri: string; expiresAt: number };
const directory = FileSystem.documentDirectory + 'filimehome/';
const key = (uid: string) => 'filimehome.downloads.' + uid;
export async function readDownloads(uid: string): Promise<Download[]> {
  const entries: Download[] = JSON.parse(await AsyncStorage.getItem(key(uid)) || '[]');
  const valid: Download[] = [];
  for (const entry of entries) {
    if (!entry.uri.startsWith(directory)) continue;
    const info = await FileSystem.getInfoAsync(entry.uri);
    if (entry.expiresAt > Date.now() && info.exists && canDownload(entry.movie)) valid.push(entry);
    else await FileSystem.deleteAsync(entry.uri, { idempotent: true });
  }
  await AsyncStorage.setItem(key(uid), JSON.stringify(valid));
  return valid;
}
export async function downloadMovie(uid: string, movie: Movie, progress: (fraction: number) => void) {
  const current = await catalog.get(movie.id);
  if (!current || !canDownload(current)) throw new Error('This title is not authorized for offline MP4 viewing.');
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const uri = directory + encodeURIComponent(uid + '-' + movie.id) + '.mp4';
  const download = FileSystem.createDownloadResumable(current.download_url!, uri, {}, event => {
    progress(event.totalBytesExpectedToWrite > 0 ? event.totalBytesWritten / event.totalBytesExpectedToWrite : 0);
  });
  try {
    const result = await download.downloadAsync();
    const contentType = Object.entries(result?.headers ?? {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1];
    if (!result || result.status !== 200 || (contentType && !/video\/mp4|application\/octet-stream/i.test(contentType))) {
      throw new Error('The download did not return a valid MP4 response.');
    }
    const entries = await readDownloads(uid);
    const entry = { movie: current, uri, expiresAt: Date.now() + 7 * 24 * 3600000 };
    await AsyncStorage.setItem(key(uid), JSON.stringify([...entries.filter(e => e.movie.id !== movie.id), entry]));
  } catch (e) { await FileSystem.deleteAsync(uri, { idempotent: true }); throw e; }
}
export async function removeDownload(uid: string, id: string) {
  const entries = await readDownloads(uid);
  for (const entry of entries.filter(e => e.movie.id === id)) await FileSystem.deleteAsync(entry.uri, { idempotent: true });
  await AsyncStorage.setItem(key(uid), JSON.stringify(entries.filter(e => e.movie.id !== id)));
}
export async function clearDownloads(uid: string) {
  for (const entry of await readDownloads(uid)) await FileSystem.deleteAsync(entry.uri, { idempotent: true });
  await AsyncStorage.removeItem(key(uid));
}
