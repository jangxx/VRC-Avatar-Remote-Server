const { isBlankString } = require("../src/pure_utils");

class AvatarParamControl {
	constructor(definition) {
		// performs deserialization
		this._id = definition.id;
		this._parameterName = definition.parameterName;
		this._icon = definition.icon;
		this._label = definition.label;

		if (isBlankString(this._parameterName)) throw new Error("Parameter name can not be blank");

		this._dataType = definition.dataType; // bool, int, float
		if (!["bool", "int", "float"].includes(this._dataType)) {
			throw new Error(`Invalid data type ${this._dataType}`);
		}

		this._controlType = definition.controlType; // button, toggle, range
		if (!["button", "toggle", "range"].includes(this._controlType)) {
			throw new Error(`Invalid data type ${this._dataType}`);
		}

		this._setValue = definition.setValue;
		if (!this.isSetValueLegal(this._setValue)) {
			throw new Error("Invalid set value for the chosen dataType and controlType combination");
		}

		this._defaultValue = definition.defaultValue;
		if (!this.isDefaultValueLegal(this._defaultValue)) {
			throw new Error("Invalid default value for the chosen dataType and controlType combination");
		}

		if (this._label == null) {
			this._label = `${this._controlType} ${this._parameterName}`;
		}
	}

	get id() { return this._id; }

	get parameterName() { return this._parameterName; }

	get label() { return this._label; }

	get icon() { return this._icon; }

	get types() {
		return {
			data: this._dataType,
			control: this._controlType,
		};
	}

	serialize() {
		return {
			id: this._id,
			parameterName: this._parameterName,
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

	isSetValueLegal(value) {
		switch(this._controlType) {
			case "range":
				return value === null || value === undefined; // no set value allowed for range
			case "button":
			case "toggle":
				return this.isValueLegal(value);
			default:
				return false;
		}
	}

	isDefaultValueLegal(value) {
		switch(this._controlType) {
			case "range":
				return value === null || value === undefined; // no default value allowed for range and toggle
			case "toggle":
			case "button":
				return this.isValueLegal(value);
			default:
				return false;
		}
	}

	unsetIcon() {
		this._icon = null;
	}

	async performAction() {
		throw new Error("Not implemented");
	}

	async setValue() {
		throw new Error("Not implemented");
	}

	isToggled() {
		throw new Error("Not implemented");
	}
 }

exports.AvatarParamControl = AvatarParamControl;