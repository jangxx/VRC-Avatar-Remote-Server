# VRChat Avatar Remote Server

A server to create "dashboards" to let other people control selected avatar parameters via a web interface.
Each avatar is set up individually and the parameters can be controlled with a button, a toggle switch and a rotrary input (emulating some of the built-in Action Menu controls).

There are two main ways to install and run this server:

1. Run it in a container with docker-compose (recommended)
2. Build and run it directly on your machine

This readme documents how to do these options.

## Running the server with docker-compose

Running the server with `docker compose` makes it easy to use the software without having to install Node.js or build any software.
It also makes it easy to expose the server to the internet with a cloudflare tunnel, allowing other people to use it without having to expose any ports or the like.

### Prerequisites:

- Docker (on Windows you probably want to use [Docker Desktop](https://www.docker.com/products/docker-desktop/) for convenience)

### Installation

Download `docker-compose.yml` from the root of the repository and put it somewhere on your computer, ideally in an empty folder somewhere.

### Running the server

To run the first time setup run

```bash
docker compose run --rm server
```

The setup will ask you if you run in docker; answer this with `y`.
Afterwards you have to create an admin password.
If you want to change it later, you can either remove the `admin.password` key from the config file (which is created in a folder named `config` next to the compose file) to summon the prompt again, or go to a website like [bcrypt-generator.com](https://bcrypt-generator.com/) and "encrypt" your new password there before putting it into the config file.

Once the first time setup is complete you can run the server like this:

```bash
docker compose up -d
```

The `-d` flag will make the server run in the background. If you prefer to run it in the foreground, you can leave it out.

You can now access the dashboard on `localhost:8080` and set up your boards.

You can stop the server by running `docker compose down` in the same folder, or by using the Docker Desktop's UI.

### Opening a cloudflare tunnel

If you want to expose your remote on the internet, one way to do this is by using a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/).

The compose file supports two flavors of tunnels, ephemeral and normal. The advantage of an emphemeral tunnel is that you don't needto register anywhere and can just run it, but with the disadvantage of always getting a random URL on each start, instead of a fixed one.

To activate the ephemeral tunnel, run `docker compose --profile cloudflare-quick up`.
Notice how we're not using the `-d` flag to run it in the background.
This is because we need to get the tunnel address from the output of the `cloudflared` service.
Alternatively you can add the `-d` flag and use `docker compose logs cloudflared-quick` to see the output after the fact.

To use a "normal" tunnel, you first need to configure it according to the [documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/).
Afterwards you can get the token from the connector view.
It's a long string starting with `ey`, which you need to put in a file called `.env` next to your compose file, with the following format

```env
CLOUDFLARE_TOKEN=ey[...]
```

Afterwards you can run `docker compose --profile cloudflare up -d` to run the software and the tunnel in the background.

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
If you want to change it later you can either remove the `admin.password` key from the config file to summon the prompt again or go to a website like [bcrypt-generator.com](https://bcrypt-generator.com/) and "encrypt" your new password there before putting it into the config file.

## Using the software

The actual web interface should be self-explanatory.
To get started navigate to `/admin` relative to the address of the server and log in with your admin password.
You can then follow the interface to create a new board, add avatars and controls to it and more.

### API Keys

If you want to interact with the boards from another piece of software, you can authenticate with the server using a key sent within the `X-API-Key` header. 
To add an API key, simply generate a long random string (for example with a password generator) and then add it to the `server.api_keys` list in the config file, while the server is not running.

Documentation of the actual endpoints is left as an exercise for the future, but these are the broad strokes to point you in the right direction:

- Admin functionality is performed with routes under `/api/admin/*`, with the actual code for the routes being in `src/routes/admin.js`.
- To get information about a board, use the routes under `/api/b/$boardId/*`. You can find the code in `src/routes/board.js`.
- All of the realtime functionality (triggering controls and getting updates) uses socket.io. Opening the connection requires setting a `target` query parameter which identifies the board by id. The server sends `avatar` and `parameter` events in reaction to changes, while clients can send `set-parameter` and `perform-action` events, to set values and toggle buttons respectively. The code for this can be found in `src/socket_manager.js`.

## Troubleshooting

**The boards always says 'The currently selected avatar has no controls on this board'**

The server is only informed of avatar changes, so if you restart the server you need to switch _into_ an avatar you have set up before the server displays the respective board.

Also make sure that the server is actually receiving OSC messages from VRChat.
Is VRChat configured to send OSC packets to the right address that the server is listening on?
By default VRChat sends OSC packets to `localhost:9001` and the server listens to the same address, but if you run the server on another PC or have multiple clients listening (with my [UDP Multiplexer](https://github.com/jangxx/UDP-Multiplexer) for example), these addresses can deviate from the defaults.

You can debug all incoming data by setting `osc.log_all_inputs` in the config file to `true` and then observing the logs for logged packets.

**Buttons/Toggles/Rotaries don't work**

Make sure that the server is sending data to the right address that VRChat is listening on.
By default VRChat listens on port 9000 on all addresses and the server sends data to `localhost:9000` (or `host.docker.internal` when running in docker respectively), but if you run the server on a different machine or in a VM you need to set the output port and address within the config file to the correct values.
