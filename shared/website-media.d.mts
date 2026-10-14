import type { Movie } from '../src/types';
export function websiteOptions(row: Record<string, unknown>): Record<string, unknown>[];
export function websiteMovie(row: Record<string, unknown>): Movie;
export function resolveWebsiteMovie(row: Record<string, unknown>, request?: typeof fetch): Promise<Movie>;
