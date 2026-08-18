FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-noto-cjk ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json server.mjs ./
ENV PORT=8080
EXPOSE 8080
CMD ["node","server.mjs"]
