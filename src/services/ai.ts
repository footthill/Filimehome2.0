import { GoogleGenAI } from "@google/genai";
import { Movie } from "../types";

let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("VITE_GEMINI_API_KEY is not configured.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function getRecommendations(watchlist: string[], ratings: Record<string, number>, allMovies: Movie[]): Promise<string[]> {
  if (watchlist.length === 0 && Object.keys(ratings).length === 0) {
    return ["Dune: Part Two", "Furiosa: A Mad Max Saga", "Shogun"];
  }

  const watchlistTitles = watchlist.map(id => allMovies.find(m => m.id === id)?.title).filter(Boolean);
  const ratedTitles = Object.entries(ratings).map(([id, score]) => {
    const movie = allMovies.find(m => m.id === id);
    return movie ? `${movie.title} (${score}/5 stars)` : null;
  }).filter(Boolean);

  const prompt = `Based on my favorite movies/shows, suggest 3 more that I might like.
Current Watchlist: ${watchlistTitles.join(", ")}
My Ratings: ${ratedTitles.join(", ")}

Return only the titles of 3 movies or TV shows as a JSON array of strings.`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("AI Error:", error);
    return ["Dune: Part Two", "Furiosa: A Mad Max Saga", "Shogun"];
  }
}

export async function searchMoviesAI(query: string): Promise<Partial<Movie>[]> {
  const prompt = `Act as a movie database search engine. For the query "${query}", return 3 relevant movies or TV shows.
Include: title, type (movie/tv), year, description, genres.
Return as a JSON array of objects.`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("AI Search Error:", error);
    return [];
  }
}

export async function chatWithAI(messages: { role: 'user' | 'model', text: string }[]): Promise<string> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      })),
      config: {
        systemInstruction: "You are the FilmHome Genie, an elegant, passionate, and cinema-obsessed movie assistant. You are chatting over a WhatsApp-style integration. Help the user find the perfect movie, translate titles, find local Abasobanuzi voiceover details, or suggest films. Keep your answers engaging, warm, helpful, and concise (under 3-4 sentences total). Use some emojis to make it feel like WhatsApp.",
      }
    });

    return response.text || "I'm having trouble getting the perfect movie for you right now. Try again!";
  } catch (error) {
    console.error("AI Chat Error:", error);
    return "I had trouble tapping into the cinematic frequencies. What film or genre can I help you find? 🎬";
  }
}

