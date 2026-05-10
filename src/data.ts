import { Movie } from './types';

export const INITIAL_MOVIES: Movie[] = [
  {
    id: '1',
    title: 'Dune: Part Two',
    type: 'movie',
    year: 2024,
    rating: 8.9,
    genres: ['Sci-Fi', 'Adventure'],
    posterUrl: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop',
    description: 'Paul Atreides unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.',
    cast: ['Timothée Chalamet', 'Zendaya', 'Rebecca Ferguson']
  },
  {
    id: '2',
    title: 'The Bear',
    type: 'tv',
    year: 2022,
    rating: 8.6,
    genres: ['Drama'],
    posterUrl: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1974&auto=format&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1974&auto=format&fit=crop',
    description: 'A young chef from the fine dining world comes home to Chicago to run his family sandwich shop.',
    cast: ['Jeremy Allen White', 'Ebon Moss-Bachrach']
  },
  {
    id: '3',
    title: 'Civil War',
    type: 'movie',
    year: 2024,
    rating: 7.5,
    genres: ['Action', 'Thriller'],
    posterUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2059&auto=format&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2059&auto=format&fit=crop',
    description: 'A journey across a dystopian future America, following a team of military-embedded journalists as they race against time to reach DC.',
    cast: ['Kirsten Dunst', 'Wagner Moura']
  },
  {
    id: '4',
    title: 'War Machine',
    type: 'movie',
    year: 2024,
    rating: 8.1,
    genres: ['Action', 'Adventure'],
    posterUrl: 'https://images.unsplash.com/photo-1590177602111-0552723c04bc?q=80&w=2070&auto=format&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1590177602111-0552723c04bc?q=80&w=2070&auto=format&fit=crop',
    description: 'Survive the fight. A gritty look at modern warfare.',
    cast: ['John Doe', 'Jane Smith']
  },
  {
    id: '5',
    title: 'Switch: Change the World',
    type: 'tv',
    year: 2024,
    rating: 9.1,
    genres: ['Drama', 'Mystery'],
    posterUrl: 'https://images.unsplash.com/photo-1540656616422-491955583ad5?q=80&w=1974&auto=format&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1540656616422-491955583ad5?q=80&w=1974&auto=format&fit=crop',
    description: 'A brilliant conman takes on the identity of a prosecutor to seek justice.',
    cast: ['Jang Geun-suk', 'Han Ye-ri']
  },
  {
    id: '6',
    title: 'Legends of the Condor Heroes',
    type: 'movie',
    year: 2024,
    rating: 8.4,
    genres: ['Action', 'Fantasy'],
    posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1974&auto=format&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1974&auto=format&fit=crop',
    description: 'A classic wuxia adaptation with stunning visuals and epic battles.',
    cast: ['Xiao Zhan', 'Zhuang Dafei']
  },
  {
    id: '7',
    title: 'Mom',
    type: 'movie',
    year: 2023,
    rating: 7.2,
    genres: ['Drama', 'Thriller'],
    posterUrl: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=2070&auto=format&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=2070&auto=format&fit=crop',
    description: 'A mother searches for her missing daughter in a high-stakes race against time.',
    cast: ['Sridevi', 'Akshaye Khanna']
  },
  {
    id: '8',
    title: 'Veil of Shadows',
    type: 'tv',
    year: 2024,
    rating: 8.7,
    genres: ['Horror', 'Mystery'],
    posterUrl: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=2070&auto=format&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=2070&auto=format&fit=crop',
    description: 'Something lurks in the darkness of this small coastal town.',
    cast: ['David Harbour', 'Winona Ryder']
  }
];
