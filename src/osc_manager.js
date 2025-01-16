const { EventEmitter } = require("events");

const { Client, Server } = require("node-osc");

class OscManager extends EventEmitter {
	constructor(config) {
		super();

		this._config = config;

		this._printInputs = false;
		this._printOutputs = false;
		this._logErrors = false;

		this._oscServer = null;
		this._oscClient = null;
	}

	init() {
		this._printInputs = this._config.getKey("osc", "log_all_inputs") === true;
		this._printOutputs = this._config.getKey("osc", "log_all_outputs") === true;
		this._logErrors = this._config.getKey("osc", "log_errors") === true;

		const sendPort = this._config.getRequiredKey("osc", "output", "port");
		const sendAddress = this._config.getRequiredKey("osc", "output", "address");

		const port = this._config.getRequiredKey("osc", "listen", "port");
		const address = this._config.getRequiredKey("osc", "listen", "address");

		this._oscServer = new Server(port, address, () => {
			console.log(`OSC server is listening on ${address}:${port}`);
		});

		this._oscClient = new Client(sendAddress, sendPort);
		console.log(`OSC messages will be sent to ${sendAddress}:${sendPort}`);

		this._oscServer.on("message", (msg) => {
			if (this._printInputs) {
				console.log("Received OSC Message:", msg);
			}

			const [ address, value ] = msg;

			this.emit("message", { address, value });
		});

		this._oscServer.on("error", err => {
			if (this._logErrors) {
				console.log("OSC encountered an error:", err);
			}
		});
	}

	sendMessage(address, value, type) {
		if (this._oscClient === null) {
			throw new Error("Not initialized");
		}

		let sendValue = null;

		switch (type) {
			case "bool":
				sendValue = value ? true : false;
				break;
			case "int":
				sendValue = Math.floor(value);
				break;
			case "float":
				sendValue = Number(value);
				break;
			default:
				throw new Error(`Invalid OSC type ${type}`);
		}	

		this._oscClient.send(address, sendValue, () => {
			console.log("Sent OSC Message:", [ address, value, type ]);
		});
	}
}

module.exports = { OscManager };