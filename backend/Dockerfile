# This Dockerfile exists for exactly one reason: Smart Student Import's
# scanned-PDF OCR path (Phase 3) shells out to `pdftoppm` (part of
# poppler-utils) to render PDF pages into images before running OCR on
# them. Render's standard "Native Environment" (buildpack-based) has no
# apt-get access at all, so there's no way to install a system package
# there — a Docker-based deploy is the only way to get poppler-utils
# onto the server. Nothing else in the app needs a custom build
# environment; mammoth and tesseract.js-core are pure JS/WASM with no
# native compilation step.
#
# To switch this Render service to Docker: in the Render dashboard, go to
# the backend service → Settings → Build & Deploy → change the runtime
# from "Node" to "Docker", and point it at this file
# (backend/Dockerfile, with the repo root or backend/ as the Docker
# build context — adjust the COPY paths below if your context differs).
# Environment variables already configured on the service (DATABASE_URL,
# DIRECT_URL, GROQ_API_KEY, etc.) carry over unchanged — Docker deploys
# still read process.env the normal way.

FROM node:22-slim

# poppler-utils: provides pdftoppm.
# No compiler/build-essential needed — none of this app's dependencies
# require native compilation (tesseract.js-core ships prebuilt WASM).
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installed before copying the rest of the source so this layer is
# cached and skipped on rebuilds that don't touch package.json.
COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# Render sets PORT automatically at runtime; src/index.js already reads
# process.env.PORT with a fallback, so no hardcoded EXPOSE value matters
# here beyond documentation.
EXPOSE 4000

CMD ["node", "src/index.js"]
