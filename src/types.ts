export interface Movie {
  id: string;
  title: string;
  type: 'movie' | 'tv';
  year: number;
  rating: number; // average rating 0-10
  userRating?: number; // 0-5 stars
  posterUrl: string;
  backdropUrl: string;
  description: string;
  genres: string[];
  cast: string[];
}

export interface UserData {
  watchlist: string[]; // movie IDs
  ratings: Record<string, number>; // movie ID -> rating
}
