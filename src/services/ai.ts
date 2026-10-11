import { Movie } from '../types';
import { supabase } from '../lib/supabaseClient';

// Recommendations only reference titles in the actual catalog.
export async function getRecommendations(watchlist: string[], ratings: Record<string, number>, movies: Movie[]): Promise<string[]> {
  const liked = movies.filter(m => watchlist.includes(m.id) || (ratings[m.id] ?? 0) >= 4);
  const genres = new Set(liked.flatMap(m => m.genres));
  return [...movies].filter(m => !watchlist.includes(m.id))
    .sort((a, b) => b.genres.filter(g => genres.has(g)).length - a.genres.filter(g => genres.has(g)).length)
    .slice(0, 3).map(m => m.title);
}
export async function chatWithAI(messages: { role: 'user' | 'model'; text: string }[]): Promise<string> {
  try {
    const session = await supabase?.auth.getSession();
    const token = session?.data.session?.access_token;
    if (!token) return 'Sign in from Profile to use the assistant.';
    const response = await fetch('/api/assistant', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ messages: messages.slice(-10) }),
    });
    if (!response.ok) return 'The assistant is unavailable. You can search the catalog in Explore.';
    const data = await response.json();
    return typeof data.text === 'string' ? data.text : 'No response was received.';
  } catch { return 'Unable to reach the assistant. Check your connection and try again.'; }
}


