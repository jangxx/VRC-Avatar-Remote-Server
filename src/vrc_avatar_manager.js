const { EventEmitter} = require("events");

const { TimedBuffer } = require("./timed_buffer");

const PARAM_RE = /^\/avatar\/(\w+)(?:\/(\w+))?$/;
const EXCLUDE_RE = /^(?:Angular|Velocity)(?:X|Y|Z)$/

class VrcAvatarManager extends EventEmitter {
	constructor(oscManager) {
		super();

		this._osc = oscManager;
		this._buffer = new TimedBuffer(32);

		this._currentAvatar = {
			id: null,
			params: {}
		};
	}

	init() {
		this._osc.on("message", msg => {
			const m = msg.address.match(PARAM_RE);

			if (m == null) return;

			switch (m.group(2)) {
				case "change": // avatar was changed
					// TODO: change and reset current avi, emit event, etc
					break;
				case "parameters":
					if (EXCLUDE_RE.test(m.group(3))) return;

					this._buffer.add(msg.address, msg, 400);
					this._currentAvatar.params[m.group(3)] = msg.value;
					
					this.emit("parameter", {
						name: m.group(3),
						value: msg.value,
						avatar: this._currentAvatar.id,
					});

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
}

module.exports = { VrcAvatarManager };