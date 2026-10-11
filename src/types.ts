export interface Movie {
  id: string;
  title: string;
  poster: string;
  image: string;
  genres: string[];
  narrator: string;
  country: string;
  release_date: string;
  modifiedAt: string;
  video_url: string;
  type: 'movie' | 'tv' | 'unknown';
  description?: string;
  published?: boolean;
  featured?: boolean;
  trending?: boolean;
  streaming_authorized?: boolean;
  offline_authorized?: boolean;
  download_url?: string;
  subtitles?: { label: string; language: string; url: string }[];
  qualities?: { label: string; url: string }[];
  episodes?: { id: string; title: string; season: number; number: number; video_url: string; streaming_authorized: boolean }[];
}

export interface UserData {
  watchlist: string[]; // movie IDs
  ratings: Record<string, number>; // movie ID -> rating
}

