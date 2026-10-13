import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { Movie } from '../../src/types';
import { canDownload } from '../../shared/domain.mjs';
import { mediaError, mediaHeaders, validateDownload, unexpired } from '../../shared/media.mjs';
import { catalog } from './backend';

export type Download = { movie: Movie; uri: string; expiresAt: number; size?: number; md5?: string };
export type DownloadJob = { uid: string; id: string; title: string; status: 'checking' | 'downloading' | 'pausing' | 'paused' | 'verifying' | 'complete' | 'canceled' | 'error'; progress: number; error: string; bytes: number };
const directory = FileSystem.documentDirectory + 'filimehome/';
const key = (uid: string) => 'filimehome.downloads.' + uid;
const listeners = new Set<() => void>();
const jobs = new Map<string, DownloadJob>();
const running = new Set<string>();
const transfers = new Map<string, FileSystem.DownloadResumable>();
let storageQueue: Promise<unknown> = Promise.resolve();
const notify = () => listeners.forEach(listener => listener());
const jobKey = (uid: string, id: string) => uid + ':' + id;
export function subscribeDownloads(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function downloadJobs(uid: string) { return [...jobs.values()].filter(job => job.uid === uid).map(job => ({ ...job })); }
function serialized<T>(action: () => Promise<T>): Promise<T> {
  const next = storageQueue.then(action, action); storageQueue = next.catch(() => {}); return next;
}
function owns(uri: string, uid: string) {
  if (typeof uri !== 'string' || !uri.startsWith(directory)) return false;
  const name = uri.slice(directory.length);
  return !name.includes('/') && name.startsWith(encodeURIComponent(uid + '-')) && name.endsWith('.mp4');
}
async function entries(uid: string): Promise<Download[]> {
  try { const value = JSON.parse(await AsyncStorage.getItem(key(uid)) || '[]'); return Array.isArray(value) ? value : []; }
  catch { throw new Error('The saved download index is damaged. Remove downloads from Settings and retry.'); }
}
export async function readDownloads(uid: string): Promise<Download[]> {
  return serialized(async () => {
    const valid: Download[] = [];
    for (const entry of await entries(uid)) {
      if (!entry?.movie || !owns(entry.uri, uid)) continue;
      const info = await FileSystem.getInfoAsync(entry.uri, { md5: true });
      // Source URL expiry does not revoke an already granted local offline lease.
      if (entry.expiresAt > Date.now() && entry.movie.published === true && entry.movie.offline_authorized === true && info.exists && !info.isDirectory && info.size >= 12 && (!entry.size || entry.size === info.size) && (!entry.md5 || entry.md5 === info.md5)) valid.push(entry);
      else await FileSystem.deleteAsync(entry.uri, { idempotent: true });
    }
    await AsyncStorage.setItem(key(uid), JSON.stringify(valid));
    return valid;
  });
}
export function startDownload(uid: string, movie: Movie) {
  if (!uid || !canDownload(movie)) throw new Error('This title is not authorized for offline MP4 viewing.');
  const key = jobKey(uid, movie.id);
  const previous = jobs.get(key);
  if (running.has(key) || (previous && !['complete', 'canceled', 'error'].includes(previous.status))) throw new Error('This title already has an active download.');
  const job: DownloadJob = { uid, id: movie.id, title: movie.title, status: 'checking', progress: 0, error: '', bytes: 0 };
  jobs.set(key, job); notify();
  void run(job);
}
async function run(job: DownloadJob, resume = false) {
  const key = jobKey(job.uid, job.id);
  running.add(key);
  let partial = transfers.get(key)?.fileUri;
  let promoted: string | undefined;
  try {
    // Refresh rights and expiring sources before every start/resume. Never resolve legacy links.
    const current = await catalog.get(job.id);
    if (!current || !canDownload(current)) throw new Error('Download permission or source has expired. Refresh this title.');
    if (job.status === 'canceled') return;
    const existing = (await readDownloads(job.uid)).find(entry => entry.movie.id === job.id);
    if (existing && !resume) { job.status = 'complete'; job.progress = 1; notify(); return; }
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const free = await FileSystem.getFreeDiskStorageAsync();
    if (free < (current.download_size || 0) + 16 * 1024 * 1024) throw new Error('Not enough storage for this download.');
    let transfer = transfers.get(key);
    if (!resume || !transfer) {
      partial = directory + encodeURIComponent(job.uid + '-' + job.id + '-' + Date.now()) + '.mp4.part';
      transfer = FileSystem.createDownloadResumable(current.download_url!, partial, { headers: mediaHeaders(current.media_headers), md5: true }, event => {
        job.bytes = event.totalBytesExpectedToWrite > 0 ? event.totalBytesExpectedToWrite : job.bytes;
        job.progress = job.bytes > 0 ? Math.min(0.99, event.totalBytesWritten / job.bytes) : 0; notify();
      });
      transfers.set(key, transfer);
    } else if (transfer.savable().url !== current.download_url) {
      throw new Error('The download URL changed. Cancel this paused transfer and start a fresh download.');
    }
    if (job.status as string === 'canceled') { await transfer.cancelAsync(); return; }
    job.status = 'downloading'; notify();
    const result = resume ? await transfer.resumeAsync() : await transfer.downloadAsync();
    if (job.status as string === 'canceled') return;
    if (['paused', 'pausing'].includes(job.status as string)) return;
    job.status = 'verifying'; notify();
    const info = await FileSystem.getInfoAsync(partial!, { md5: true });
    const integrity = validateDownload(result, info, current, job.bytes);
    const prefix = await FileSystem.readAsStringAsync(partial!, { encoding: FileSystem.EncodingType.Base64, position: 0, length: 32 });
    if (atob(prefix).slice(4, 8) !== 'ftyp') throw new Error('Download returned a non-MP4 file.');
    if (job.status as string === 'canceled') return;
    if (!unexpired(current.offline_expires_at)) throw new Error('Offline permission expired during the download. Refresh the title.');
    const uri = partial!.replace(/\.part$/, '');
    await FileSystem.moveAsync({ from: partial!, to: uri }); promoted = uri;
    const lease = current.offline_expires_at ? Date.parse(current.offline_expires_at) : Infinity;
    const entry: Download = { movie: current, uri, expiresAt: Math.min(Date.now() + 7 * 24 * 3600000, lease), ...integrity };
    await serialized(async () => {
      if (job.status as string === 'canceled') throw new Error('Download canceled.');
      const previous = await entries(job.uid);
      await AsyncStorage.setItem(keyFor(job.uid), JSON.stringify([...previous.filter(e => e.movie.id !== current.id), entry]));
      for (const old of previous.filter(e => e.movie.id === current.id && owns(e.uri, job.uid) && e.uri !== uri)) await FileSystem.deleteAsync(old.uri, { idempotent: true });
    });
    promoted = undefined; job.status = 'complete'; job.progress = 1;
  } catch (error) {
    if (!['canceled', 'paused', 'pausing'].includes(job.status as string)) { job.status = 'error'; job.error = mediaError(error); }
  } finally {
    if (!['paused', 'pausing'].includes(job.status as string)) {
      if (partial) await FileSystem.deleteAsync(partial, { idempotent: true }).catch(() => {});
      if (promoted) await FileSystem.deleteAsync(promoted, { idempotent: true }).catch(() => {});
      transfers.delete(key);
    }
    running.delete(key); notify();
  }
}
const keyFor = key;
export async function pauseDownload(uid: string, id: string) {
  const key = jobKey(uid, id), job = jobs.get(key), transfer = transfers.get(key);
  if (!job || !transfer || job.status !== 'downloading') return;
  job.status = 'pausing'; notify();
  try { await transfer.pauseAsync(); if (job.status as string === 'pausing') job.status = 'paused'; }
  catch { job.status = 'downloading'; throw new Error('This source cannot pause. Cancel and restart if needed.'); }
  finally { notify(); }
}
export function resumeDownload(uid: string, id: string) {
  const job = jobs.get(jobKey(uid, id));
  if (job?.status === 'paused' && !running.has(jobKey(uid, id))) { job.status = 'checking'; notify(); void run(job, true); }
}
export async function cancelDownload(uid: string, id: string) {
  const key = jobKey(uid, id), job = jobs.get(key), transfer = transfers.get(key);
  if (job && job.status !== 'complete') { job.status = 'canceled'; notify(); }
  if (transfer) {
    await transfer.cancelAsync();
    await FileSystem.deleteAsync(transfer.fileUri, { idempotent: true }); transfers.delete(key);
  }
}
export async function removeDownload(uid: string, id: string) {
  await cancelDownload(uid, id);
  await serialized(async () => {
    const previous = await entries(uid);
    for (const entry of previous.filter(entry => entry.movie.id === id && owns(entry.uri, uid))) await FileSystem.deleteAsync(entry.uri, { idempotent: true });
    await AsyncStorage.setItem(key(uid), JSON.stringify(previous.filter(entry => entry.movie.id !== id)));
  });
}
export async function clearDownloads(uid: string) {
  for (const job of downloadJobs(uid)) await cancelDownload(uid, job.id);
  await serialized(async () => {
    for (const entry of await entries(uid)) if (owns(entry.uri, uid)) await FileSystem.deleteAsync(entry.uri, { idempotent: true });
    await AsyncStorage.removeItem(key(uid));
  });
}
