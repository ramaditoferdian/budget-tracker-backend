// src/config/corsConfig.ts

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL_LOCAL,
  process.env.FRONTEND_URL_DEV,
  process.env.FRONTEND_URL_PROD,
  'http://localhost:3000',
  // Allow Vercel preview URLs that match the pattern `budget-tracker-*`
  /https:\/\/budget-tracker-.*\.vercel\.app$/, // Regex untuk menangkap subdomain budget-tracker-*
].filter(Boolean); // supaya gak ada undefined kalau lupa isi .env

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Memeriksa apakah origin adalah undefined atau ada dalam daftar allowedOrigins
    const isAllowedOrigin = allowedOrigins.some((allowedOrigin) => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin || '');
      }
      return false;
    });

    if (!origin || isAllowedOrigin) {
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
