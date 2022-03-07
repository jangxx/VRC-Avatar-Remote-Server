class AvatarParamControl {
	constructor(definition) {
		// performs deserialization
		this._id = definition.id;
		this._name = definition.name;
		this._icon = definition.icon;
		this._label = definition.label;

		this._dataType = definition.dataType; // bool, int, float
		if (!["bool", "int", "float"].includes(this._dataType)) {
			throw new Error(`Invalid data type ${this._dataType}`);
		}

		this._controlType = definition.controlType; // button, toggle, range
		if (!["button", "toggle", "range"].includes(this._controlType)) {
			throw new Error(`Invalid data type ${this._dataType}`);
		}

		this._setValue = definition.setValue;
		if (!this.isValueLegal(this._setValue)) {
			throw new Error("Invalid set value");
		}

		this._defaultValue = definition.defaultValue;
		if (!this.isValueLegal(this._defaultValue)) {
			throw new Error("Invalid default value");
		}

		if (this._label === null) {
			this._label = `${this._controlType} ${this._name}`;
		}
	}

	get id() { return this._id; }

	get name() { return this._name; }

	get types() {
		return {
			data: this._dataType,
			control: this._controlType,
		};
	}

	serialize() {
		return {
			name: this._name,
			label: this._label,
			icon: this._icon,
			dataType: this._dataType,
			controlType: this._controlType,
			setValue: this._setValue,
			defaultValue: this._defaultValue,
		};
	}

	clone() {
		return new AvatarParamControl(this.serialize());
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

	async performAction() {
		throw new Error("Not implemented");
	}

	async setValue() {
		throw new Error("Not implemented");
	}

	isToggled(avatarController) {
		if (this._controlType !== "toggle") throw new Error("This method is not allowed for this control type");

		const currentVal = avatarController.getParameter(this.name);
		return currentVal == this._setValue;
	}
 }

// module.exports = { AvatarParamControl };
exports.AvatarParamControl = AvatarParamControl;
// export { AvatarParamControl };