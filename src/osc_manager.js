const { EventEmitter } = require("events");

const { Client, Server } = require("node-osc");

class OscManager extends EventEmitter {
	constructor(config) {
		super();

		this._config = config;

		this._server = null;
		this._client = null;
	}

	init() {
		this._client = new Client(
			this._config.getRequiredKey("osc", "output", "address"),
			this._config.getRequiredKey("osc", "output", "port"),
		);

		const port = this._config.getRequiredKey("osc", "listen", "port");
		const address = this._config.getRequiredKey("osc", "listen", "address");

		this._server = new Server(port, address, () => {
				console.log(`OSC server is listening on ${address}:${port}`);
			}
		);

		this._server.on("message", msg => {
			this.emit("message", {
				address: msg[0],
				value: msg[1],
			});
		});
	}

	sendMessage(address, value) {
		if (this._client === null) {
			throw new Error("Not initialized");
		}

		return new Promise((resolve, reject) => {
			this._client.send(address, value, err => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}
}

module.exports = { OscManager };