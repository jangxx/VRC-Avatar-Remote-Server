const { EventEmitter} = require("events");

const { TimedBuffer } = require("./timed_buffer");

const PARAM_RE = /^\/avatar\/(\w+)(?:\/(\w+))?$/;
const EXCLUDE_RE = /^(?:Angular|Velocity)(?:X|Y|Z)$/

class VrcAvatarManager extends EventEmitter {
	constructor(oscManager) {
		super();

		this._osc = oscManager;
		this._buffer = new TimedBuffer();

		this._currentAvatar = {
			id: null,
			params: {}
		};
	}

	_processParameterUpdate(paramName, value) {
		this._currentAvatar.params[paramName] = value;
					
		this.emit("parameter", {
			name: paramName,
			value: value,
			avatar: this._currentAvatar.id,
		});
	}

	init() {
		this._osc.on("message", msg => {
			const m = msg.address.match(PARAM_RE);

			if (m == null) return;

			switch (m[1]) {
				case "change": // avatar was changed
					const avatarId = msg.value;

					this.emit("avatar", {
						id: avatarId,
					});

					this._currentAvatar.id = avatarId;
					this._currentAvatar.params = {};

					this._buffer.getAll().forEach(msg => {
						const m = msg.address.match(PARAM_RE);
						this._processParameterUpdate(m[2], msg.value);
					});

					break;
				case "parameters":
					if (EXCLUDE_RE.test(m[2])) return;

					this._buffer.add(msg.address, msg, 400);
					this._processParameterUpdate(m[2], msg.value);

					break;
			}
		});
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

	async setParameter(paramName, value) {
		await this._osc.sendMessage(`/avatar/parameters/${paramName}`, value);
		// we're not updating the currentAvatar here. it will get updated soon after the game sends the update back to us
	}

	forceSetParameter(paramName, value) {
		this._processParameterUpdate(paramName, value);
	}
}

module.exports = { VrcAvatarManager };