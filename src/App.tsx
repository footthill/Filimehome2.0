import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search as SearchIcon, Bell, Star, Film, Sparkles, Plus, Loader2, Bookmark, Menu, Share2, Play, ChevronRight, ChevronLeft } from 'lucide-react';
import { Movie } from './types';
import { INITIAL_MOVIES } from './data';
import { Navbar } from './components/Navbar';
import { MovieCard } from './components/MovieCard';
import { MovieDetail } from './components/MovieDetail';
import { Sidebar } from './components/Sidebar';
import { cn } from './lib/utils';
import { getRecommendations, searchMoviesAI, chatWithAI } from './services/ai';
import { fetchTrending, fetchByType, searchMovies } from './services/tmdb';

export default function App() {
  const [movies, setMovies] = useState<Movie[]>(INITIAL_MOVIES);
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('watchlist');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [userRatings, setUserRatings] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('userRatings');
    return saved ? JSON.parse(saved) : {};
  });

  const [aiRecs, setAiRecs] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem('userRatings', JSON.stringify(userRatings));
  }, [userRatings]);

  useEffect(() => {
    const loadData = async () => {
      const trending = await fetchTrending();
      if (trending.length > 0) {
        setMovies(trending);
      }
    };
    loadData();
  }, []);

  const toggleWatchlist = (id: string) => {
    setWatchlist(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const rateMovie = (id: string, rating: number) => {
    setUserRatings(prev => ({ ...prev, [id]: rating }));
  };

  const fetchAiRecs = async () => {
    setIsAiLoading(true);
    const recs = await getRecommendations(watchlist, userRatings, movies);
    setAiRecs(recs);
    setIsAiLoading(false);
  };

  return (
    <Router>
      <div className="relative min-h-screen text-white bg-[#0e0e0e]">
        <div className="atmosphere" />
        
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <Routes>
          <Route path="/" element={
            <HomeView 
              movies={movies} 
              aiRecs={aiRecs} 
              onRefreshRecs={fetchAiRecs}
              isAiLoading={isAiLoading}
              onOpenSidebar={() => setIsSidebarOpen(true)}
            />
          } />
          <Route path="/search" element={
            <SearchView allMovies={movies} />
          } />
          <Route path="/watchlist" element={
            <WatchlistView movies={movies} watchlist={watchlist} />
          } />
          <Route path="/library" element={
            <WatchlistView movies={movies} watchlist={watchlist} />
          } />
          <Route path="/chat" element={<ChatRedirect />} />
          <Route path="/movie/:id" element={
            <MovieDetail 
              movies={movies} 
              watchlist={watchlist} 
              userRatings={userRatings}
              onToggleWatchlist={toggleWatchlist} 
              onRate={rateMovie} 
            />
          } />
          <Route path="/profile" element={<ProfileView />} />
        </Routes>

        <Navbar />
      </div>
    </Router>
  );
}

function ChatRedirect() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'model'; text: string; time: string }>>([
    {
      role: 'model',
      text: "👋 Hello! Welcome to FilmHome's WhatsApp Cinema assistant. I am your movie Genie! 🎬\n\nAsk me anything! For example:\n🍿 'Suggest a steamy romance movie'\n🌟 'Where can I find Abasobanuzi voiceovers?'\n🔥 'What are the top action seasons?'",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setInput("");
    
    setMessages(prev => [...prev, {
      role: 'user',
      text: userMsg,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    setIsTyping(true);

    // Call real Gemini API
    const contextMessages = messages.map(m => ({ role: m.role, text: m.text }));
    contextMessages.push({ role: 'user', text: userMsg });

    const reply = await chatWithAI(contextMessages);
    
    setIsTyping(false);
    setMessages(prev => [...prev, {
      role: 'model',
      text: reply,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-[#0b141a] text-white pb-20 select-none">
      {/* WhatsApp Custom Header */}
      <div className="bg-[#075e54] px-4 pt-12 pb-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1 hover:bg-black/10 rounded-full transition-colors">
            <ChevronLeft className="h-6 w-6 text-white" />
          </Link>
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10 overflow-hidden font-black text-yellow-500 fill-current">
              🍿
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#075e54] rounded-full" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">FilmHome Genie</h3>
            <p className="text-[10px] text-green-300 font-medium">
              {isTyping ? "typing..." : "online"}
            </p>
          </div>
        </div>
        
        {/* Safe External Redirect Button */}
        <a 
          href="https://wa.me/250700000000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25d366] hover:bg-[#20ba5a] active:scale-95 transition-all rounded-full text-[10px] font-black uppercase text-black"
        >
          Open App
        </a>
      </div>

      {/* WhatsApp Chat Bubbles Wrapper */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar bg-cover bg-center bg-opacity-[0.04]" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')" }}>
        {messages.map((m, idx) => {
          const isMe = m.role === 'user';
          return (
            <div 
              key={idx} 
              className={cn(
                "flex w-full mb-1",
                isMe ? "justify-end" : "justify-start"
              )}
            >
              <div 
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 relative shadow-sm text-sm whitespace-pre-wrap leading-relaxed",
                  isMe 
                    ? "bg-[#056162] text-white rounded-tr-none" 
                    : "bg-[#202c33] text-white rounded-tl-none border border-white/5"
                )}
              >
                <p className="text-sm font-medium">{m.text}</p>
                <div className="text-[9px] text-white/40 text-right mt-1.5 font-bold">
                  {m.time}
                </div>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="flex w-full justify-start">
            <div className="bg-[#202c33] text-white rounded-2xl rounded-tl-none px-4 py-3 border border-white/5 shadow-sm">
              <div className="flex gap-1.5 items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 bg-[#111b21] flex items-center gap-2 border-t border-white/5">
        <input 
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 h-11 bg-[#2a3942] focus:outline-none rounded-full px-5 text-sm placeholder:text-white/30 text-white font-medium"
        />
        <button 
          type="submit" 
          disabled={!input.trim()}
          className="h-11 w-11 rounded-full bg-[#00a884] hover:bg-[#008f72] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer text-white"
        >
          <Play className="h-5 w-5 fill-current ml-0.5" />
        </button>
      </form>
    </div>
  );
}

function HomeView({ movies, aiRecs, onRefreshRecs, isAiLoading, onOpenSidebar }: { 
  movies: Movie[], 
  aiRecs: string[], 
  onRefreshRecs: () => void,
  isAiLoading: boolean,
  onOpenSidebar: () => void
}) {
  return (
    <div className="pb-32">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 pt-10 pb-4 glass transition-all">
        <button onClick={onOpenSidebar} className="text-white/80 hover:text-white transition-colors">
          <div className="flex flex-col gap-1.5 w-6">
            <div className="h-[2px] w-full bg-white rounded-full" />
            <div className="h-[2px] w-2/3 bg-white rounded-full" />
            <div className="h-[2px] w-full bg-white rounded-full" />
          </div>
        </button>
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-yellow-500 flex items-center justify-center">
             <Star className="h-4 w-4 text-black fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tighter uppercase italic">FilmHome</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/search">
            <SearchIcon className="h-5 w-5 text-white/80 hover:text-white transition-colors" />
          </Link>
          <button className="h-8 w-8 flex items-center justify-center rounded bg-green-500 shadow-lg shadow-green-500/20 active:scale-95 transition-transform">
             <Share2 className="h-4 w-4 text-white fill-current" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="mt-28 space-y-10">
        {/* Top Feature Sliders (The big vertical ones) */}
        <section className="px-6 grid grid-cols-2 gap-4">
           {movies[3] && <MovieCard movie={movies[3]} variant="vertical" />}
           {movies[4] && <MovieCard movie={movies[4]} variant="vertical" />}
        </section>

        {/* Large Horizontal Highlight */}
        <section className="px-6">
           {movies[4] && <MovieCard movie={movies[4]} variant="horizontal" />}
        </section>

        {/* AI Recommendations */}
        <section className="px-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              <h3 className="text-lg font-black uppercase italic tracking-tighter">AI Recommendations</h3>
            </div>
            <button 
              onClick={onRefreshRecs}
              disabled={isAiLoading}
              className="text-[10px] font-black uppercase tracking-widest text-yellow-500 hover:text-yellow-400 disabled:opacity-50 flex items-center gap-1"
            >
              {isAiLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              {aiRecs.length > 0 ? "Refresh" : "Show Magic"}
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {aiRecs.length > 0 ? (
              aiRecs.map((title, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                   <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                     <Play className="h-5 w-5 text-yellow-500 fill-current" />
                   </div>
                   <div className="flex-1">
                     <h4 className="font-bold text-sm leading-tight mb-0.5">{title}</h4>
                     <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500/60">Suggested for you</p>
                   </div>
                   <ChevronRight className="h-4 w-4 text-white/20" />
                </div>
              ))
            ) : (
              <div onClick={onRefreshRecs} className="p-8 rounded-[32px] bg-yellow-500/5 border border-dashed border-yellow-500/20 text-center space-y-2 cursor-pointer active:scale-95 transition-transform">
                 <p className="text-xs text-yellow-500/60 font-black uppercase tracking-[0.2em]">Click to reveal recommendations</p>
              </div>
            )}
          </div>
        </section>

        {/* Scrolling Rows */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-6">
            <h3 className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2 text-white">
              Hot Seasons You Can't Miss <ChevronRight className="h-4 w-4 text-yellow-500" />
            </h3>
          </div>
          <div className="flex gap-4 overflow-x-auto px-6 no-scrollbar pb-2">
            {movies.map(movie => (
              <div key={movie.id} className="w-28 flex-shrink-0">
                <MovieCard movie={movie} variant="compact" />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between px-6">
            <h3 className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2 text-white">
              Steamy Romance Hits <ChevronRight className="h-4 w-4 text-yellow-500" />
            </h3>
          </div>
          <div className="flex gap-4 overflow-x-auto px-6 no-scrollbar pb-2">
            {movies.filter(m => m.type === 'movie').map(movie => (
              <div key={movie.id} className="w-28 flex-shrink-0">
                <MovieCard movie={movie} variant="compact" />
              </div>
            ))}
          </div>
        </section>

        {/* Another Horizontal card */}
        <section className="px-6">
           {movies[7] && <MovieCard movie={movies[7]} variant="horizontal" />}
        </section>

        {/* Small vertical cards grid */}
        <section className="px-6 grid grid-cols-2 gap-4">
           {movies[5] && <MovieCard movie={movies[5]} variant="vertical" />}
           {movies[6] && <MovieCard movie={movies[6]} variant="vertical" />}
        </section>
      </div>
    </div>
  );
}

function SearchView({ allMovies }: { allMovies: Movie[] }) {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [tmdbResults, setTmdbResults] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const genreParam = searchParams.get('genre');
    if (genreParam) {
      setQuery(genreParam);
      const runSearch = async () => {
        setIsSearching(true);
        const [aiRes, tmdbRes] = await Promise.all([
          searchMoviesAI(genreParam),
          searchMovies(genreParam)
        ]);
        setAiResults(aiRes);
        setTmdbResults(tmdbRes);
        setIsSearching(false);
      };
      runSearch();
    }
  }, [searchParams]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setIsSearching(true);
    
    // Parallel search: AI + TMDB
    const [aiRes, tmdbRes] = await Promise.all([
      searchMoviesAI(query),
      searchMovies(query)
    ]);
    
    setAiResults(aiRes);
    setTmdbResults(tmdbRes);
    setIsSearching(false);
  };

  const localResults = allMovies.filter(m => 
    m.title.toLowerCase().includes(query.toLowerCase()) || 
    m.genres.some(g => g.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="px-6 pb-32 pt-12 space-y-8 min-h-screen">
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 glass rounded-full"><ChevronLeft className="h-6 w-6" /></Link>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter">Explore</h2>
      </div>
      
      <form onSubmit={handleSearch} className="relative group">
        <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 group-focus-within:text-yellow-500 transition-colors" />
        <input 
          type="text" 
          placeholder="Search movies, shows, or genres..."
          className="w-full h-16 bg-white/5 border border-white/10 rounded-3xl pl-14 pr-4 font-bold text-sm focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all placeholder:text-white/20"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <div className="space-y-8">
        {tmdbResults.length > 0 && query && (
          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">From the Global Vault</h3>
            <div className="grid grid-cols-2 gap-4">
              {tmdbResults.map(movie => (
                <div key={movie.id}>
                  <MovieCard movie={movie} />
                </div>
              ))}
            </div>
          </section>
        )}

        {query && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">AI Deep Discovery</h3>
              {isSearching && <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />}
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {aiResults.map((m, idx) => (
                <div key={idx} className="p-6 rounded-[32px] glass space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-lg leading-tight flex-1 pr-4">{m.title}</h4>
                    <span className="text-[10px] font-black uppercase p-1 px-3 rounded-full bg-white/10">{m.type}</span>
                  </div>
                  <p className="text-sm text-white/60 line-clamp-3 leading-relaxed">{m.description}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {m.genres?.map((g: string) => (
                      <span key={g} className="text-[10px] font-black uppercase tracking-widest text-yellow-500/50">{g}</span>
                    ))}
                  </div>
                </div>
              ))}
              {!isSearching && aiResults.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 opacity-20">
                   <Sparkles className="h-10 w-10 mb-2" />
                   <p className="text-xs font-black uppercase tracking-widest">Ask AI for recommendations</p>
                </div>
              )}
            </div>
          </section>
        )}

        {!query && (
          <div className="space-y-4 pt-10">
             <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">Popular Search</h3>
             <div className="flex flex-wrap gap-2">
                {['Action', 'Thriller', 'Horror', 'Romantic', 'Sci-Fi', 'Mystery', 'Crime'].map(tag => (
                  <button onClick={() => setQuery(tag)} key={tag} className="px-4 py-2 rounded-2xl glass text-xs font-bold hover:bg-white/10 transition-colors uppercase tracking-widest text-white">
                    {tag}
                  </button>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WatchlistView({ movies, watchlist }: { movies: Movie[], watchlist: string[] }) {
  const watchlistedMovies = movies.filter(m => watchlist.includes(m.id));

  return (
    <div className="px-6 pb-32 pt-12 space-y-8 min-h-screen">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter">My Watchlist</h2>
        <span className="h-8 w-8 rounded-full bg-yellow-500 flex items-center justify-center text-xs font-black text-black shadow-lg shadow-yellow-500/20">{watchlist.length}</span>
      </div>
      
      {watchlistedMovies.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          <AnimatePresence>
            {watchlistedMovies.map(movie => (
              <motion.div 
                key={movie.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <MovieCard movie={movie} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="py-20 text-center space-y-6">
          <div className="h-24 w-24 bg-white/5 rounded-[48px] flex items-center justify-center mx-auto border border-white/5">
             <Bookmark className="h-10 w-10 text-white/10" />
          </div>
          <div className="space-y-2">
            <p className="text-white/40 font-black uppercase tracking-widest">Your list is cold</p>
            <p className="text-xs text-white/20 px-8">Save movies you're dying to see here.</p>
          </div>
          <Link to="/" className="inline-block px-8 py-4 rounded-2xl bg-yellow-500 text-black font-black uppercase tracking-widest text-[10px] shadow-xl shadow-yellow-500/20 active:scale-95 transition-transform">Start Exploring</Link>
        </div>
      )}
    </div>
  );
}

function ProfileView() {
  return (
    <div className="px-6 pb-32 pt-24 space-y-12 min-h-screen">
      <div className="flex flex-col items-center text-center space-y-6">
        <div className="h-36 w-36 rounded-[56px] bg-gradient-to-br from-yellow-500/20 to-red-500/20 p-1 shadow-2xl">
          <div className="h-full w-full rounded-[52px] bg-surface flex items-center justify-center overflow-hidden border border-white/5">
            <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=2080&auto=format&fit=crop" className="h-full w-full object-cover" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-4xl font-black italic uppercase tracking-tighter">Cinephile Alex</h2>
          <p className="text-[10px] text-yellow-500 font-black tracking-[0.3em] uppercase opacity-60">Gold Member Elite</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-5 rounded-[32px] glass text-center space-y-1">
          <div className="text-2xl font-black italic">128</div>
          <div className="text-[8px] uppercase text-white/40 font-black tracking-widest">Seen</div>
        </div>
        <div className="p-5 rounded-[32px] glass text-center space-y-1">
          <div className="text-2xl font-black italic">42</div>
          <div className="text-[8px] uppercase text-white/40 font-black tracking-widest">Votes</div>
        </div>
        <div className="p-5 rounded-[32px] glass text-center space-y-1">
          <div className="text-2xl font-black italic">15h</div>
          <div className="text-[8px] uppercase text-white/40 font-black tracking-widest">Time</div>
        </div>
      </div>

      <div className="space-y-3">
        <button className="w-full flex items-center justify-between px-6 py-5 rounded-[32px] glass font-black uppercase tracking-widest text-[10px] text-white/80 hover:text-white transition-colors">
          Account Intelligence <Plus className="h-4 w-4 text-white/20 rotate-45" />
        </button>
        <button className="w-full flex items-center justify-between px-6 py-5 rounded-[32px] glass font-black uppercase tracking-widest text-[10px] text-white/80 hover:text-white transition-colors">
          Cinephile Preferences <Plus className="h-4 w-4 text-white/20 rotate-45" />
        </button>
        <button className="w-full flex items-center justify-between px-6 py-5 rounded-[32px] glass font-black uppercase tracking-widest text-[10px] text-red-500">
          Eject Mission
        </button>
      </div>
    </div>
  );
}
