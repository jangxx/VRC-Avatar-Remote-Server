# VRChat OSC Remote Server

A server to create "dashboards" to let other people control selected avatar parameters via a webinterface.
Each avatar is set up individually and the parameters can be controlled with a button, a toggle switch and a rotrary input (emulating some of the built-in Action Menu controls).

There are three main way to install and run this server:

1. Build and run it directly on your machine
2. Run it in a container with docker
3. Run it in a container with docker-compose

This readme documents how to do each of these options.

## Building and installing locally

### Prerequisites:

- Node.js v16+

### Installation

1. Clone the repository
2. `cd` into it
3. Run `npm install` to install the required modules for the server
4. `cd client`
5. Run `npm install` to install the required modules for the frontend
6. `npm run build` to build the frontend 

### Running the server

`cd` into the cloned repository and run `node ./ /path/to/config.yml [/path/to/icons]`.
You need to pick a location for the config file (i.e. replace `/path/to/config.yml` with an actual path).
If you want to just store it in the same folder as the cloned repository, you can set the path to `./config.yml`, but you can also put it anywhere else on your PC.
The second parameter is optional, since the path where the uploaded icons are stored can also be set in the config file (Default: `./icons`).

The first time you launch the server you are asked if you are currently running in a docker container.
Answer this question with `n`.
Afterwards you have to create an admin password.
If you want to change it later you can either clear remove the `admin.password` key from the config file to summon the prompt again or go to a website like [bcrypt-generator.com](https://bcrypt-generator.com/) and "encrypt" your new password there before putting it into the config file.

## Running in a docker container

### Prerequisites:

- Docker (on Windows you probably want to use [Docker Desktop](https://www.docker.com/products/docker-desktop/) for convenience)

### Installation

1. Clone the repository
2. `cd` into it
3. Run `docker build ./ -t vrc-param-server`

### Running the server

To run the first time setup run

```bash
docker run -it --rm -v /path/to/your/config/directory:/data/config vrc-param-server
```

Note that the path to the config directory has to be absolute.
If you want to use a relative path you can write something like `$(pwd)/config` to place the config file in `./config`.

**Important note for Git Bash users on windows**: Git bash fucks up your paths so you need to prepend `MSYS_NO_PATHCONV=1` to the command, otherwise docker will complain about broken paths.

The setup will ask you if you run in docker; answer this with `y`.
Afterwards you have to create an admin password.

Once the first time setup is complete you can run the server like this:

```bash
docker run \
	-d \ # run as a deamon
	--restart unless-stopped \ # automatically (re)start the server when your PC restarts
	-v /path/to/your/config/directory:/data/config \
	-v /path/to/icons:/data/config \ # optionally set the path to where icons should be stored
	-b 8080:8080 # set the address and port for the webinterface
	-b 9001:9001/udp # set the OSC input port
```

## Running the server with docker-compose

Running the server with `docker-compose` has two main advantages compared to running it in Docker directly:

1. You can easily change all the config in `docker-compose.yml` directly and recreate everything with a single command
2. You can run `cloudflared` alongside it with a single command which not only removes the need for port forwarding, but also takes care of creating an encrypted tunnel directly to the server.

### Prerequisites:

- Docker (on Windows you probably want to use [Docker Desktop](https://www.docker.com/products/docker-desktop/) for convenience)

### Installation

1. Clone the repository
2. `cd` into it
3. Run `docker compose build`

### Running the server

Open `docker-compose.yml` and set the path of the config directory to a path of your choosing (or leave it as `./config` to store it in the same folder as the cloned repository).
You can also add another entry to the `volumes` to set the path of where icons should be stored (e.g. `- "./icons:/data/icons"`).
If this is not set the icons will be stored in an unnamed docker volume.

If you have a domain and a tunnel set up on cloudflare, you can log into the [dashboard](https://dash.teams.cloudflare.com/), go to _Access -> Tunnels_, click on _Configure_ next to the tunnel you want to use, click on the Docker environment button and copy the part of the command after `docker run cloudflare/cloudflared:<version>`, which should look something like `tunnel --no-autoupdate run --token <long string of characters>`.
Paste this part into the `docker-compose.yml` so it replaces the word `tunnel` in `services.cloudflared.command` (**keep the --url part after tunnel**).

If you don't have a tunnel set up you can either consult [cloudflares documentation ](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/) or continue with ephemeral tunnels.

To run the first time setup run

```bash
docker compose run --rm vrc-param-server
```

The setup will ask you if you run in docker; answer this with `y`.
Afterwards you have to create an admin password.

Once the first time setup is complete you can run the server like this:

```bash
docker compose up -d
```

You can now access the dashboard on `localhost:45000` or via the tunnel address.
If you use an ephemeral tunnel, you can run `docker logs vrc-osc-remote-server-cloudflared-1` and find the part at the top that says something like

```
2022-08-07T14:33:13Z INF Requesting new quick Tunnel on trycloudflare.com...
2022-08-07T14:33:16Z INF +--------------------------------------------------------------------------------------------+
2022-08-07T14:33:16Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
2022-08-07T14:33:16Z INF |  https://<some prefix>.trycloudflare.com                                            |
2022-08-07T14:33:16Z INF +--------------------------------------------------------------------------------------------+
```

Opening the URL there should bring up the server UI while also being reachable from the internet without additional setup.

You can stop the server by running

```bash
docker compose down
```

## Using the software

The actual web interface should be self-explanatory.
To get started navigate to `/admin` relative to the address of the server and log in with your admin password.
You can then follow the interface to create a new board, add avatars and controls to it and more.

### API Keys

**Documentation coming soon**

## Troubleshooting

**The boards always says 'The currently selected avatar has no controls on this board'**

The server is only informed of avatar changes, so if you restart the server you need to switch _into_ an avatar you have set up before the server displays the respective board.

Also make sure that the server is actually receiving OSC messages from VRChat.
Is VRChat configured to send OSC packets to the right address that the server is listening on?
By default VRChat sends OSC packets to `localhost:9001` and the server listens to the same address, but if you run the server on another PC or have multiple clients listening (with my [UDP Multiplexer](https://github.com/jangxx/UDP-Multiplexer) for example), these addresses can deviate from the defaults.

You can debug all incoming data by setting `osc.log_all_inputs` in the config file to `true` and then observing the logs for logged packets.

**Buttons/Toggles/Rotraries don't work**

Make sure that the server is sending data to the right address that VRChat is listening on.
By default VRChat listens on port 9000 on all addresses and the server sends data to `localhost:9000` (i.e. `host.docker.internal` when running in docker), but if you run the server on a different machine or in a VM you need to set the output port and address within the config file to the correct values.