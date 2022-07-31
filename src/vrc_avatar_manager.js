const { EventEmitter} = require("events");

const { TimedBuffer } = require("./timed_buffer");
const { OscManager } = require("./osc_manager");
const { Config } = require("./config");
const { sha1 } = require("./utils");

class VrcAvatarManager extends EventEmitter {
	/**
	 * 
	 * @param {OscManager} oscManager 
	 * @param {Config} config 
	 */
	constructor(oscManager, config) {
		super();

		this._osc = oscManager;
		this._config = config;
		this._buffer = new TimedBuffer();

		this._inputParams = {};
		this._currentAvatar = {
			id: null,
			params: {}
		};

		this._avatars = {};

		this._avatarIdHashCache = {};
	}

	_processParameterUpdate(inputAddress, value) {
		if (!(inputAddress in this._inputParams)) return;

		const paramName = this._inputParams[inputAddress];
		this._currentAvatar.params[paramName] = value;
					
		this.emit("parameter", {
			name: paramName,
			value: value,
			avatar: this._currentAvatar.id,
		});
	}

	init() {
		this._osc.on("message", msg => {
			if (msg.address === "/avatar/change") {
				const avatarId = msg.value;

				this.emit("avatar", {
					id: avatarId,
				});

				this._currentAvatar.id = avatarId;
				this._currentAvatar.params = {};

				if (avatarId in this._avatars) {
					this._inputParams = Object.fromEntries(Object.entries(this._avatars[avatarId]).map(e => [ e[1].input, e[0] ]));
				} else {
					this._inputParams = {};
				}

				this._buffer.getAll().forEach(msg => {
					this._processParameterUpdate(msg.address, msg.value);
				});
			} else {
				this._buffer.add(msg.address, msg, 400);
				this._processParameterUpdate(msg.address, msg.value);
			}
		});

		this._avatars = this._config.getRequiredKey("avatars");

		for (let avid in this._avatars) {
			for (let paramName in this._avatars[avid]) {
				if (!("input" in this._avatars[avid][paramName])) {
					throw new Error(`Input address is missing from parameter ${paramName} of avatar ${avid}`);
				}
				if (!("output" in this._avatars[avid][paramName])) {
					throw new Error(`Output address is missing from parameter ${paramName} of avatar ${avid}`);
				}
			}
		}
	}

	getCurrentAvatarId() {
		return this._currentAvatar.id;
	}

	getCurrentParams() {
		return Object.assign({}, this._currentAvatar.params);
	}

	getParameter(paramName) {
		if (paramName in this._currentAvatar.params) {
			return this._currentAvatar.params[paramName];
		} else {
			return null;
		}
	}

	getAllRegisteredParams() {
		return Object.assign({}, this._avatars);
	}

	async setParameter(paramName, value, type) {
		const avid = this._currentAvatar.id;

		if (!(avid in this._avatars && paramName in this._avatars[avid])) return;

		await this._osc.sendMessage(this._avatars[avid][paramName].output, value, type);
		// we're not updating the currentAvatar here. it will get updated soon after the game sends the update back to us
	}

	async registerNewParameter({ avid, paramName, inputAddress, outputAddress }) {
		if (!(avid in this._avatars)) {
			this._avatars[avid] = {};
		}

		this._avatars[avid][paramName] = {
			input: inputAddress,
			output: outputAddress,
		};

		if (avid === this._currentAvatar.id) { // update the input params so that the new control work immediately without an avatar switch
			this._inputParams = Object.fromEntries(Object.entries(this._avatars[this._currentAvatar.id]).map(e => [ e[1].input, e[0] ]));
		}

		await this._config.setKey("avatars", this._avatars);
	}

	async unregisterParameter(avid, paramName) {
		if (!(avid in this._avatars)) {
			return;
		}

		delete this._avatars[avid][paramName];

		await this._config.setKey("avatars", this._avatars);
	}

	forceSetParameter(paramName, value, type) {
		this._processParameterUpdate(paramName, value, type);
	}

	hashAvatarId(avid) {
		const avid_h = sha1(avid);
		this._avatarIdHashCache[avid_h] = avid;
		return avid_h;
	}

	unhashAvatarId(avid_h) {
		return this._avatarIdHashCache[avid_h];
	}
}

module.exports = { VrcAvatarManager };