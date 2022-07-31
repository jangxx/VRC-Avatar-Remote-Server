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

		avatarManager.setParameter(this.parameterName, value, this.types.data);
	}

	/**
	 * Performs the action this controlType defines
	 * @param {VrcAvatarManager} avatarManager 
	 */
	async performAction(avatarManager) {
		if (!["button", "toggle"].includes(this._controlType)) throw new Error("This method is not allowed for this control type");

		if (this._controlType === "button") {
			if (this._currentlyActive) return; // ignore

			let currentVal = avatarManager.getParameter(this.parameterName);
			currentVal = (currentVal !== null) ? currentVal : this._defaultValue;

			this._currentlyActive = true;
			await avatarManager.setParameter(this.parameterName, this._setValue, this.types.data);
			
			await awaitableTimeout(1000);

			this._currentlyActive = false;
			await avatarManager.setParameter(this.parameterName, currentVal);
		} else if (this._controlType == "toggle") {
			if (avatarManager.getParameter(this.parameterName) === null) {
				// if the value is unknown try to set the sert value and then pretend like the value is definitely set
				// either this will toggle the toggle, or it is already toggled
				// in both scenarios we land in a consistent state
				await avatarManager.setParameter(this.parameterName, this._setValue, this.types.data);
				avatarManager.forceSetParameter(this.parameterName, this._setValue, this.types.data);
				return;
			}

			if (this.isToggled(avatarManager)) {
				await avatarManager.setParameter(this.parameterName, this._defaultValue, this.types.data);
			} else {
				await avatarManager.setParameter(this.parameterName, this._setValue, this.types.data);
			}
		}
	}

	isToggled(avatarManager) {
		if (this._controlType !== "toggle") throw new Error("This method is not allowed for this control type");

		const currentVal = avatarManager.getParameter(this.parameterName);
		// console.log(this._label, this._name, currentVal);
		return currentVal !== null && currentVal === this._setValue;
	}
}

module.exports = { BackendAvatarParamControl };