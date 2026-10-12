import type { Movie } from '../src/types';
export function secureUrl(value: unknown): string;
export function videoContentType(value: unknown): 'hls' | 'progressive' | null;
export function secureVideoUrl(value: unknown): string;
export function normalizeMovie(row: unknown): Movie;
export function filterCatalog(movies: Movie[], query?: string, genre?: string, type?: string): Movie[];
export function canStream(movie: Movie | null | undefined): boolean;
export function canDownload(movie: Movie | null | undefined): boolean;
export function resumePosition(position: number, duration: number): number;
