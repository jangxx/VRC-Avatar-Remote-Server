const { VrcAvatarManager } = require("./vrc_avatar_manager");


class AvatarParamControl {
	constructor(definition) {
		// performs deserialization
		this._name = definition.name;
		this._dataType = definition.dataType; // bool, int, float
		this._controlType = definition.controlType; // button, toggle, range

		this._setValue = definition.setValue;
		this._defaultValue = definition.defaultValue;
	}

	get name() { return this._name; }

	get types() {
		return {
			data: this._dataType,
			control: this._controlType,
		};
	}

	_serialize() {
		return {
			name: this._name,
			dataType: this._dataType,
			controlType: this._controlType,
			setValue: this._setValue,
			defaultValue: this._defaultValue,
		};
	}

	clone() {
		return new AvatarParamControl(this._serialize());
	}

	isValueLegal(value) {
		switch(this._dataType) {
			case "bool":
				return typeof value === 'boolean';
			case "int":
				return Number.isInteger(value) && value >= 0 && value <= 255;
			case "float":
				return Number.isFinite(value) && value >= -1 && value <= 1;
			default:
				return false;
		}
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

	isToggled() {
		if (this._controlType !== "toggle") throw new Error("This method is not allowed for this control type");

		const currentVal = avatarManager.getParameter(this.name);
		return currentVal == this._setValue;
	}
 }

module.exports = { AvatarParamControl };