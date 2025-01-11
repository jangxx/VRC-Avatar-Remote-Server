FROM node:16

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

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