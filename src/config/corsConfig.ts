// src/config/corsConfig.ts

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL_LOCAL,
  process.env.FRONTEND_URL_DEV,
  process.env.FRONTEND_URL_PROD,
  'http://localhost:3000',
].filter(Boolean); // supaya gak ada undefined kalau lupa isi .env

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: "GET,POST,PUT,DELETE",
  credentials: true,
};

export default corsOptions;
