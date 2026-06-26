import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // TMDB Proxy API route
  app.get("/api/tmdb/:path(*)", async (req, res) => {
    const { path: tmdbPath } = req.params;
    
    // Check if key exists
    if (!process.env.TMDB_API_KEY) {
      return res.status(500).json({ error: "TMDB_API_KEY environment variable is not set" });
    }

    const query = new URLSearchParams(req.query as Record<string, string>).toString();
    const url = `https://api.themoviedb.org/3/${tmdbPath}?${query}&api_key=${process.env.TMDB_API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("TMDB Proxy Error:", error);
      res.status(500).json({ error: "Failed to fetch from TMDB" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
