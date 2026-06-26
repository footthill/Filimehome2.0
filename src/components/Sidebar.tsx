import React from 'react';
import { Home, Compass, MessageCircle, Zap, Smile, BookOpen, Skull, Map, Cpu, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const mainItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Compass, label: 'Explore', path: '/search' },
    { icon: MessageCircle, label: 'Chat on WhatsApp', path: '/chat', color: 'text-green-500' },
  ];

  const genres = [
    { icon: Zap, label: 'Action', emoji: '🔥' },
    { icon: Smile, label: 'Comedy', emoji: '🔥' },
    { icon: BookOpen, label: 'Drama', emoji: '🔥' },
    { icon: Skull, label: 'Horror', emoji: '🔥' },
    { icon: Map, label: 'Adventure', emoji: '🔥' },
    { icon: Cpu, label: 'Sci-Fi', emoji: '🔥' },
  ];

  return (
    <>
      {/* Overlay */}
      <div 
        className={cn(
          "fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 bottom-0 z-[70] w-72 bg-[#121212] transition-transform duration-500 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col p-6">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-2">
               <div className="h-8 w-8 rounded-lg bg-yellow-500 flex items-center justify-center">
                 <Zap className="h-5 w-5 text-black fill-current" />
               </div>
               <span className="text-xl font-black italic tracking-tighter uppercase">FilmHome</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-8 flex-1 overflow-y-auto no-scrollbar">
            <div className="space-y-4">
              {mainItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-4 py-2 text-sm font-bold transition-colors",
                      isActive ? "text-yellow-500" : (item.color || "text-gray-400 hover:text-white")
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Genres</h3>
              <div className="space-y-2">
                {genres.map((genre) => (
                  <button
                    key={genre.label}
                    onClick={() => {
                      navigate(`/search?genre=${genre.label.toUpperCase()}`);
                      onClose();
                    }}
                    className="flex w-full items-center justify-between py-2 text-sm font-bold text-gray-400 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <genre.icon className="h-5 w-5 text-green-600" />
                      <span className="text-green-600 font-medium">{genre.label}</span>
                    </div>
                    <span>{genre.emoji}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-auto pt-6 border-t border-white/5">
             <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">© {new Date().getFullYear()} FilmHome</p>
          </div>
        </div>
      </aside>
    </>
  );
}
