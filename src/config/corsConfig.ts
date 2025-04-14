// src/config/corsConfig.ts

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000", // Ganti dengan URL frontend kamu
  methods: "GET,POST,PUT,DELETE",
  credentials: true, // Menyertakan kredensial seperti cookies atau header Authorization
};

export default corsOptions;
