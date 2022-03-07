import { AvatarParamControl } from "../../../lib/avatar_param_control";
// import { AvatarParamControl } from "./avatar_param_control.js";

class SocketIoAvatarParamControl extends AvatarParamControl {
	constructor(definition, avatarId) {
		super(definition);

		this._avatarId = avatarId;
	}

	async setValue(socket, value) {
		await new Promise((resolve, reject) => {
			socket.emit("set-parameter"), {
				avatar: this._avatarId,
				controlId: this.id,
				value
			}, response => {
				if (response.success) {
					return resolve();
				} else {
					return reject(new Error(response.error));
				}
			};
		});
	}

	async performAction(socket) {
		await new Promise((resolve, reject) => {
			socket.emit("perform-action"), {
				avatar: this._avatarId,
				controlId: this.id,
			}, response => {
				if (response.success) {
					return resolve();
				} else {
					return reject(new Error(response.error));
				}
			};
		});
	}
}

export { SocketIoAvatarParamControl };