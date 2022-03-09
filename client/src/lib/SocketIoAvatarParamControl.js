import { AvatarParamControl } from "../../../lib/avatar_param_control";

class SocketIoAvatarParamControl extends AvatarParamControl {
	constructor(definition, avatarId) {
		super(definition);

		this._avatarId = avatarId;
		this._clicked = false;
	}

	clone() {
		return new SocketIoAvatarParamControl(this.serialize(), this._avatarId);
	}

	get clicked() { return this._clicked; }

	async setValue(socket, value) {
		await new Promise((resolve, reject) => {
			socket.emit("set-parameter", {
				avatar: this._avatarId,
				controlId: this.id,
				value
			}, response => {
				if (response.success) {
					return resolve();
				} else {
					return reject(new Error(response.error));
				}
			});
		});
	}

	async performAction(socket) {
		this._clicked = true;

		await new Promise((resolve, reject) => {
			socket.emit("perform-action", {
				avatar: this._avatarId,
				controlId: this.id,
			}, response => {
				this._clicked = false;

				if (response.success) {
					return resolve();
				} else {
					return reject(new Error(response.error));
				}
			});
		});
	}

	isToggled(parameterValues) {
		if (!(this.name in parameterValues)) return false;

		return parameterValues[this.name] == this._setValue;
	}
}

export { SocketIoAvatarParamControl };