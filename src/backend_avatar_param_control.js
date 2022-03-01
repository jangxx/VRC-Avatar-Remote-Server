const { AvatarParamControl } = require("../lib/avatar_param_control");
const { VrcAvatarManager } = require("./vrc_avatar_manager");

class BackendAvatarParamControl extends AvatarParamControl {
	constructor(definition) {
		super(definition);
	}

	/**
	 * Sets this parameter to the supplied value
	 * @param {VrcAvatarManager} avatarManager 
	 */
	async setValue(avatarManager, value) {
		if (!["range"].includes(this._controlType)) throw new Error("This method is not allowed for this control type");

		if (!this.isValueLegal(value)) throw new Error("This value is illegal for this data type");

		avatarManager.setParameter(this.name, value);
	}

	/**
	 * Performs the action this controlType defines
	 * @param {VrcAvatarManager} avatarManager 
	 */
	async performAction(avatarManager) {
		if (!["button", "toggle"].includes(this._controlType)) throw new Error("This method is not allowed for this control type");

		if (this._controlType === "button") {
			let currentVal = avatarManager.getParameter(this.name);
			currentVal = (currentVal !== null) ? currentVal : this._defaultValue;

			await avatarManager.setParameter(this.name, this._setValue);
			setTimeout(() => {
				avatarManager.setParameter(this.name, currentVal).catch(err => control.error("Error in unsetting button value", err));
			}, 1000);
		} else if (this._controlType == "toggle") {
			await avatarManager.setParameter(this.name, this._setValue);
		}
	}
}

module.exports = { BackendAvatarParamControl };