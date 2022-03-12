const { EventEmitter } = require("events");

const { Client, Server } = require("node-osc");

class OscManager extends EventEmitter {
	constructor(config) {
		super();

		this._config = config;

		this._printInputs = false;
		this._printOutputs = false;

		this._server = null;
		this._client = null;
	}

	init() {
		this._printInputs = this._config.getKey("osc", "log_all_inputs") === true;
		this._printOutputs = this._config.getKey("osc", "log_all_outputs") === true;

		const sendPort = this._config.getRequiredKey("osc", "output", "port");
		const sendAddress = this._config.getRequiredKey("osc", "output", "address");

		this._client = new Client(sendAddress, sendPort);
		console.log(`OSC messages will be sent to ${sendAddress}:${sendPort}`);

		const port = this._config.getRequiredKey("osc", "listen", "port");
		const address = this._config.getRequiredKey("osc", "listen", "address");

		this._server = new Server(port, address, () => {
				console.log(`OSC server is listening on ${address}:${port}`);
			}
		);

		this._server.on("message", msg => {
			if (this._printInputs) {
				console.log("Received OSC Message:", msg);
			}

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
			if (this._printOutputs) {
				console.log("Sending OSC Message:", [ address, value ]);
			}

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