# Base image Node.js
FROM node:20-buster

# Set working directory in container
WORKDIR /app

# Copy dependencies files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript (skip type errors, continue on error)
RUN npx tsc --skipLibCheck --noEmitOnError false

# Rebuild bcrypt for native support (Linux container)
RUN npm rebuild bcrypt --build-from-source

# Expose port for Fly.io (default 8080)
EXPOSE 8080

# Start the server using built JS
CMD ["npm", "run", "start"]
