const { EventEmitter } = require("events");

const osc = require("osc");

class OscManager extends EventEmitter {
	constructor(config) {
		super();

		this._config = config;

		this._printInputs = false;
		this._printOutputs = false;

		this._osc = null;
	}

	init() {
		this._printInputs = this._config.getKey("osc", "log_all_inputs") === true;
		this._printOutputs = this._config.getKey("osc", "log_all_outputs") === true;

		const sendPort = this._config.getRequiredKey("osc", "output", "port");
		const sendAddress = this._config.getRequiredKey("osc", "output", "address");

		const port = this._config.getRequiredKey("osc", "listen", "port");
		const address = this._config.getRequiredKey("osc", "listen", "address");

		this._osc = new osc.UDPPort({
			remoteAddress: sendAddress,
			remotePort: sendPort,
			localAddress: address,
			localPort: port,
		});
		console.log(`OSC messages will be sent to ${sendAddress}:${sendPort}`);

		this._osc.on("ready", () => {
			console.log(`OSC server is listening on ${address}:${port}`);
		});

		this._osc.on("message", (msg) => {
			if (this._printInputs) {
				console.log("Received OSC Message:", msg);
			}

			this.emit("message", {
				address: msg.address,
				value: msg.args[0],
			});
		});

		this._osc.on("error", err => {
			console.log("OSC encountered an error:", err);
		});

		this._osc.open();
	}

	sendMessage(address, value, type) {
		if (this._osc === null) {
			throw new Error("Not initialized");
		}

		if (this._printOutputs) {
			console.log("Sending OSC Message:", [ address, value, type ]);
		}

		switch (type) {
			case "bool":
				value = value ? 1 : 0;
				type = "i";
				break;
			case "int":
				type = "i";
				break;
			case "float":
				type = "f";
				break;
		}	

		this._osc.send({
			address,
			args: [
				{
					value,
					type,
				}
			]
		});
	}
}

module.exports = { OscManager };