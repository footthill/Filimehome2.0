import { GoogleGenAI } from "@google/genai";
import { Movie } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getRecommendations(watchlist: string[], ratings: Record<string, number>, allMovies: Movie[]): Promise<string[]> {
  if (watchlist.length === 0 && Object.keys(ratings).length === 0) {
    return [];
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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("AI Error:", error);
    return [];
  }
}

export async function searchMoviesAI(query: string): Promise<Partial<Movie>[]> {
  const prompt = `Act as a movie database search engine. For the query "${query}", return 3 relevant movies or TV shows.
Include: title, type (movie/tv), year, description, genres.
Return as a JSON array of objects.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
