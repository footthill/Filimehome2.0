import React from 'react';
import { motion } from 'motion/react';
import { Play } from 'lucide-react';
import { Movie } from '../types';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

interface MovieCardProps {
  movie: Movie;
  variant?: 'vertical' | 'horizontal' | 'compact';
}

export function MovieCard({ movie, variant = 'vertical' }: MovieCardProps) {
  if (variant === 'horizontal') {
    return (
      <Link to={`/movie/${movie.id}`}>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="group relative h-48 w-full overflow-hidden rounded-3xl bg-[#1a1a1a] border border-white/5"
        >
          <img
            src={movie.backdropUrl || movie.posterUrl}
            alt={movie.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-lg font-bold text-white mb-2 leading-tight">{movie.title}</h3>
            <button className="flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase text-black transition-colors hover:bg-white">
              <Play className="h-3 w-3 fill-current" />
              start Watching now
            </button>
          </div>
        </motion.div>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link to={`/movie/${movie.id}`}>
        <motion.div
          whileHover={{ y: -5 }}
          className="group space-y-2"
        >
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#1a1a1a]">
            <img
              src={movie.posterUrl}
              alt={movie.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-white line-clamp-1">{movie.title}</h4>
            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium">
              <span>a day ago</span>
              <span className="text-white font-bold">{movie.type === 'tv' ? 'TV Show' : 'Movie'}</span>
            </div>
          </div>
        </motion.div>
      </Link>
    );
  }

  return (
    <Link to={`/movie/${movie.id}`}>
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="group relative aspect-[3/4] overflow-hidden rounded-3xl bg-[#1a1a1a] border border-white/5"
      >
        <img
          src={movie.posterUrl}
          alt={movie.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-sm font-black text-white mb-3 leading-tight uppercase tracking-tight line-clamp-2">
            {movie.title}
          </h3>
          <button className="flex items-center gap-1 rounded-lg bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase text-black transition-colors hover:bg-white shadow-xl">
            <Play className="h-3 w-3 fill-current" />
            Watch now
          </button>
        </div>

        {/* Small Navigation Arrows inside card - decoration only */}
        <div className="absolute top-1/2 left-2 -translate-y-1/2 opacity-20 group-hover:opacity-100 transition-opacity">
          <div className="h-6 w-6 rounded-full bg-black/40 flex items-center justify-center">
            <span className="text-[10px]">‹</span>
          </div>
        </div>
        <div className="absolute top-1/2 right-2 -translate-y-1/2 opacity-20 group-hover:opacity-100 transition-opacity">
          <div className="h-6 w-6 rounded-full bg-black/40 flex items-center justify-center">
            <span className="text-[10px]">›</span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
