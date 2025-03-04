FROM node:20-alpine

LABEL org.opencontainers.image.source=https://github.com/jangxx/VRC-Avatar-Remote-Server
LABEL org.opencontainers.image.description="VRChat Avatar Remote Server"
LABEL org.opencontainers.image.licenses=MIT

WORKDIR /app

COPY package*.json ./
RUN npm install

# copy everything over (except the dockerignore'd files)
COPY . .

# install and build frontend
WORKDIR /app/client
RUN npm install
RUN npm run build

WORKDIR /app
EXPOSE 8080
EXPOSE 9001/udp

# create data directory
RUN mkdir -p /data/config
VOLUME /data/config

RUN mkdir -p /data/icons
VOLUME /data/icons

CMD [ "node", "index.js", "/data/config/config.yml", "/data/icons" ]