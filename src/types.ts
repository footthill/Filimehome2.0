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
  type: 'movie' | 'tv';
}

export interface UserData {
  watchlist: string[]; // movie IDs
  ratings: Record<string, number>; // movie ID -> rating
}
