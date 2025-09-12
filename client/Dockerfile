# client/Dockerfile
FROM node:20-slim AS build
WORKDIR /app

COPY client/package*.json ./
RUN npm ci

COPY client ./
# If you use an API base URL at build time, pass VITE_API_BASE_URL
# e.g. docker build --build-arg VITE_API_BASE_URL=http://localhost:8080
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Optional: custom nginx.conf for SPA fallback
EXPOSE 80
