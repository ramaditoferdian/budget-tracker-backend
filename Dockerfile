# Gunakan image Node.js LTS yang ringan
FROM node:20-buster

# Tentukan direktori kerja di dalam container
WORKDIR /app

# Salin file dependency terlebih dahulu (optimasi cache layer Docker)
COPY package*.json ./

# Install semua dependensi
RUN npm install

# Salin semua file proyek ke dalam container
COPY . .

# Build TypeScript ke folder dist/
RUN npm run build

# Generate Prisma client (wajib untuk bisa pakai Prisma di production)
RUN npx prisma generate

# Rebuild bcrypt agar cocok dengan lingkungan container
RUN npm rebuild bcrypt --build-from-source

# Buka port sesuai yang digunakan oleh aplikasi (bisa 3000 atau 8080, Fly pakai 8080 default)
EXPOSE 8080

# Jalankan aplikasi menggunakan file hasil build
CMD ["npm", "run", "start"]
