FROM node:16

WORKDIR /usr/src/vrc-param-server

COPY package*.json ./
RUN npm install

# copy everything over (except the dockerignore'd files)
COPY . .

# install and build frontend
WORKDIR /usr/src/vrc-param-server/client
RUN npm install
RUN npm run build

WORKDIR /usr/src/vrc-param-server
EXPOSE 8080
EXPOSE 9000/udp
EXPOSE 9001/udp

# create data directory
RUN mkdir -p /data/config
RUN mkdir -p /data/icons

CMD [ "node", "index.js", "/data/config/config.yml", "/data/icons" ]