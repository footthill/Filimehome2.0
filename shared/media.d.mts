import type { Movie } from '../src/types';
export function mediaHeaders(value: unknown): Record<string, string>;
export function unexpired(value: unknown, now?: number): boolean;
export function sourceFor(movie: Movie | null, episodeId?: string, now?: number): { uri: string; contentType: 'hls' | 'progressive'; headers: Record<string, string> };
export function mediaError(error: unknown): string;
export function validateDownload(result: unknown, info: unknown, movie: Movie, expectedBytes?: number): { size: number; md5: string };
