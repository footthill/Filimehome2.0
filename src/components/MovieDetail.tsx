import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Star, ChevronLeft, Bookmark, Play, Plus, Check } from 'lucide-react';
import { Movie } from '../types';
import { cn } from '../lib/utils';
import { fetchSimilar } from '../services/tmdb';
import { MovieCard } from './MovieCard';

interface MovieDetailProps {
  movies: Movie[];
  watchlist: string[];
  userRatings: Record<string, number>;
  onToggleWatchlist: (id: string) => void;
  onRate: (id: string, rating: number) => void;
}

export function MovieDetail({ movies, watchlist, userRatings, onToggleWatchlist, onRate }: MovieDetailProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const movie = movies.find(m => m.id === id);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);

  useEffect(() => {
    if (movie) {
      const loadSimilar = async () => {
        const similar = await fetchSimilar(movie.id, movie.type);
        setSimilarMovies(similar);
      };
      loadSimilar();
    }
  }, [movie]);

  if (!movie) return <div>Movie not found</div>;

  const isInWatchlist = watchlist.includes(movie.id);
  const userRating = userRatings[movie.id] || 0;

  return (
    <div className="min-h-screen pb-32">
      <div className="relative h-[60vh] w-full">
        <img 
          src={movie.backdropUrl} 
          alt={movie.title} 
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
        
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-12 left-6 h-12 w-12 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10"
        >
          <ChevronLeft className="h-6 w-6 text-white" />
        </button>
      </div>

      <div className="px-6 -mt-32 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight leading-tight">{movie.title}</h1>
            <div className="flex items-center gap-4 text-sm text-white/60">
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                {movie.rating}
              </span>
              <span>{movie.year}</span>
              <span className="uppercase tracking-widest text-[10px] px-2 py-1 rounded-full bg-white/10 border border-white/10">
                {movie.type}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="flex-1 h-14 flex items-center justify-center gap-2 rounded-2xl bg-red-600 font-bold text-white shadow-xl shadow-red-600/20 active:scale-95 transition-transform">
              <Play className="h-5 w-5 fill-current" />
              Watch Now
            </button>
            <button 
              onClick={() => onToggleWatchlist(movie.id)}
              className={cn(
                "h-14 w-14 flex items-center justify-center rounded-2xl transition-all active:scale-90 border",
                isInWatchlist ? "bg-white text-black border-white" : "bg-white/10 text-white border-white/10 backdrop-blur-md"
              )}
            >
              {isInWatchlist ? <Check className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-white/40">Description</h3>
            <p className="text-white/80 leading-relaxed text-lg">{movie.description}</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-white/40">Rate this {movie.type}</h3>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => onRate(movie.id, star)}
                  className="p-1 transition-transform active:scale-75"
                >
                  <Star 
                    className={cn(
                      "h-8 w-8 transition-colors",
                      star <= userRating ? "fill-yellow-500 text-yellow-500" : "text-white/20"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-white/40">Cast</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4">
              {movie.cast.map((actor, idx) => (
                <div key={idx} className="flex-shrink-0 px-4 py-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md">
                   <span className="text-sm font-medium whitespace-nowrap">{actor}</span>
                </div>
              ))}
            </div>
          </div>

          {similarMovies.length > 0 && (
            <div className="space-y-6 pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black uppercase italic tracking-tighter">Similar to this {movie.type}</h3>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6 -mx-2 px-2">
                {similarMovies.map(similar => (
                  <div key={similar.id} className="w-32 flex-shrink-0">
                    <MovieCard movie={similar} variant="compact" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
