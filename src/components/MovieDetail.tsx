import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Star, ChevronLeft, Bookmark, Play, Plus, Check } from 'lucide-react';
import { Movie } from '../types';
import { cn } from '../lib/utils';
import { fetchSimilar } from '../services/movieService';
import { MovieCard } from './MovieCard';

interface MovieDetailProps {
  movies: Movie[];
  watchlist: string[];
  onToggleWatchlist: (id: string) => void;
}

export function MovieDetail({ movies, watchlist, onToggleWatchlist }: MovieDetailProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const movie = movies.find(m => m.id === id);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [showVideo, setShowVideo] = useState(false);

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

  return (
    <div className="min-h-screen pb-32">
      {showVideo && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <button 
            onClick={() => setShowVideo(false)} 
            className="absolute top-4 right-4 z-50 bg-white/10 text-white px-4 py-2 rounded-full backdrop-blur-md"
          >
            Close
          </button>
          <video src={movie.video_url} controls className="w-full max-h-screen" autoPlay />
        </div>
      )}
      <div className="relative h-[60vh] w-full">
        <img 
          src={movie.image} 
          alt={movie.title} 
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
        
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-12 left-6 h-12 w-12 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10"
        >
          <ChevronLeft className="h-6 w-6" />
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
              <span>{movie.release_date}</span>
              <span className="uppercase tracking-widest text-[10px] px-2 py-1 rounded-full bg-white/10 border border-white/10">
                {movie.type}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setShowVideo(true)}
              className="flex-1 h-14 flex items-center justify-center gap-2 rounded-2xl bg-red-600 font-bold text-white shadow-xl shadow-red-600/20 active:scale-95 transition-transform"
            >
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
