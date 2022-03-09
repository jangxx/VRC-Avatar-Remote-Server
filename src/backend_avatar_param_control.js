const { AvatarParamControl } = require("../lib/avatar_param_control");
const { VrcAvatarManager } = require("./vrc_avatar_manager");

function awaitableTimeout(duration) {
	return new Promise(resolve => {
		setTimeout(resolve, duration);
	});
}

class BackendAvatarParamControl extends AvatarParamControl {
	constructor(definition) {
		super(definition);

		this._currentlyActive = false;
	}

	clone() {
		return new BackendAvatarParamControl(this.serialize());
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
			if (this._currentlyActive) return; // ignore

			let currentVal = avatarManager.getParameter(this.name);
			currentVal = (currentVal !== null) ? currentVal : this._defaultValue;

			this._currentlyActive = true;
			await avatarManager.setParameter(this.name, this._setValue);
			
			await awaitableTimeout(1000);

			this._currentlyActive = false;
			await avatarManager.setParameter(this.name, currentVal);
		} else if (this._controlType == "toggle") {
			if (avatarManager.getParameter(this.name) === null) {
				// if the value is unknown try to set the sert value and then pretend like the value is definitely set
				// either this will toggle the toggle, or it is already toggled
				// in both scenarios we land in a consistent state
				await avatarManager.setParameter(this.name, this._setValue);
				avatarManager.forceSetParameter(this.name, this._setValue);
				return;
			}

			if (this.isToggled(avatarManager)) {
				await avatarManager.setParameter(this.name, this._defaultValue);
			} else {
				await avatarManager.setParameter(this.name, this._setValue);
			}
		}
	}

	isToggled(avatarManager) {
		if (this._controlType !== "toggle") throw new Error("This method is not allowed for this control type");

		const currentVal = avatarManager.getParameter(this.name);
		return currentVal !== null && currentVal === this._setValue;
	}
}

module.exports = { BackendAvatarParamControl };