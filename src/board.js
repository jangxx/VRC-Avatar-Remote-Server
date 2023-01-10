const { EventEmitter } = require("events");
const bcrypt = require("bcrypt");
const { v4: uuiv4 } = require("uuid");

const { Config } = require("./config");
const { IconManager } = require("./icon_manager");
const { VrcAvatarManager } = require("./vrc_avatar_manager");
const { BackendAvatarParamControl: AvatarParamControl } = require("./backend_avatar_param_control");

/**
 * Automatically create and manage the control order to be backwards compatible
 */
function fixControlOrder(control_order, all_control_ids) {
	const ids = new Set(all_control_ids);

	if (control_order) {
		// remove entries that are in the order but not in the controls (TODO: this could also be a validation error)
		control_order = control_order.filter(cid => ids.has(cid));

		for (const cid of control_order) {
			ids.delete(cid);
		}
	} else {
		control_order = [];
	}

	return [ ...control_order, ...ids ]; // just append the non ordered ids at the end
}

class BoardAvatar {
	// performs deserialization
	constructor(definition, verifyMode = false) {
		this._name = definition.name;

		this._controls = {};
		for (const controlId in definition.controls) {
			if (verifyMode) {
				console.log(`Validating avatar control ${controlId}`);
			}
			this._controls[controlId] = new AvatarParamControl({ ...definition.controls[controlId], id: controlId });
		}

		this._controlOrder = fixControlOrder(definition.controlOrder, Object.keys(this._controls));
	}

	get name() { return this._name; }
	get controlOrder() { return this._controlOrder; }

	serialize() {
		return {
			name: this.name,
			controlOrder: this.controlOrder,
			controls: Object.fromEntries(
				Object.entries(this._controls).map(c => [c[0], c[1].serialize()] )
			),
		}
	}

	getControls() {
		return this._controlOrder.map(cid => this.getControl(cid));
	}

	getControl(id) {
		if (!(id in this._controls)) {
			throw new Error(`No control with id ${id} exists on this avatar`);
		}
		return this._controls[id];
	}

	getControlOrderedPosition(id) {
		return this._controlOrder.findIndex(cid => cid === id);
	}

	hasControl(id) {
		return id in this._controls;
	}

	updateControl(control) {
		if (!(control.id in this._controls)) {
			throw new Error(`No control with id ${control.id} exists on this avatar`);
		}
		this._controls[control.id] = control;
	}

	addControl(control, orderPosition = null) {
		this._controls[control.id] = control;

		if (orderPosition === null) {
			this._controlOrder.push(control.id);
		} else {
			this._controlOrder.splice(orderPosition, 0, control.id);
		}
	}

	removeControl(id) {
		if (!(id in this._controls)) {
			throw new Error(`No control with id ${id} exists on this avatar`);
		}
		delete this._controls[id];

		this._controlOrder = this._controlOrder.filter(cid => cid != id);
	}

	replaceControl(id, control) {
		const currentOrderPos = this.getControlOrderedPosition(id);
		this.removeControl(id);
		this.addControl(control, currentOrderPos); // splice it into the same position
	}

	setControlOrder(controlOrder) {
		// make sure that the ids in controlOrder are all correct
		for (const cid of controlOrder) {
			if (!this.hasControl(cid)) {
				throw new Error("Invalid control id");
			}
		}

		if (controlOrder.length !== Object.keys(this._controls).length) {
			throw new Error("Control order is missing some control ids");
		}

		this._controlOrder = controlOrder;
	}
}

class Board extends EventEmitter {
	/**
	 * 
	 * @param {string} id 
	 * @param {Config} config 
	 * @param {VrcAvatarManager} avatarManager
	 * @param {IconManager} iconManager
	 */
	constructor(id, config, avatarManager, iconManager) {
		super();

		this._id = id;
		this._config = config;
		this._avatarManager = avatarManager;
		this._iconManager = iconManager;

		this._password = null;
		this._name = "Unnamed Board " + Math.floor(Math.random() * 1000000);
		this._avatars = {}; // each object contains the different parameter controls that are set up
	}

	get id() {
		return this._id;
	}

	serialize(external = false, mask_ids = false) {
		return {
			password: (!external) ? this._password : (this._password !== null),
			name: this._name,
			avatars: Object.fromEntries(
				Object.entries(this._avatars).map(elem => [(mask_ids) ? this._avatarManager.hashAvatarId(elem[0]) : elem[0], elem[1].serialize()] )
			),
		};
	}

	async _store() {
		await this._config.setKey("boards", this.id, this.serialize());
		this.emit("store-config");
	}

	_load(verifyMode) {
		const boardDef = this._config.getKey("boards", this.id);
		this._deserialize(boardDef, verifyMode);
	}

	_deserialize(boardDef, verifyMode) {
		this._password = boardDef.password;
		this._name = boardDef.name;

		this._avatars = Object.fromEntries(
			Object.entries(boardDef.avatars).map(elem => {
				if (verifyMode) {
					console.log(`Validating avatar ${elem[0]}`);
				}
				return [elem[0], new BoardAvatar(elem[1], verifyMode)];
			})
		);
	}

	// only needed for the duplicate functionality
	_generateNewControlIds() {
		for (let avid in this._avatars) {
			for (const control of this._avatars[avid].getControls()) {
				const newControlId = uuiv4();
				const updatedControl = new AvatarParamControl({...control.serialize(), id: newControlId });
				this._avatars[avid].replaceControl(control.id, updatedControl);
			}
		}
	}

	hasPassword() {
		return this._password !== null;
	}

	async setPassword(password) {
		if (password === null) { // disable
			this._password = null;
		} else {
			this._password = await bcrypt.hash(password, 10);
		}

		await this._store();
	}

	async checkPassword(password) {
		if (!this.hasPassword()) {
			throw new Error("This board does not have a password");
		}
		return await bcrypt.compare(password, this._password);
	}

	hasAvatar(avid) {
		return avid in this._avatars;
	}

	hasControl(avid, id) {
		return this.hasAvatar(avid) && this._avatars[avid].hasControl(id);
	}

	getControl(avid, id) {
		if (!this.hasControl(avid, id)) {
			throw new Error("This control was not found on this board for this avatar");
		}

		return this._avatars[avid].getControl(id).clone();
	}

	getParametersForAvatar(avid) {
		const avParams = new Set();
		for (const control of this._avatars[avid].getControls()) {
			avParams.add(control.parameterName);
		}

		return [...avParams].map(parameter => {
			return { avatar: avid, parameter };
		});
	}

	getAllParametersOfAllAvatars() {
		let result = [];
		for (let avid in this._avatars) {
			const avParams = new Set();
			for (const control of this._avatars[avid].getControls()) {
				avParams.add(control.parameterName);
			}

			result = result.concat([...avParams].map(parameter => {
				return { avatar: avid, parameter };
			}));
		}
		return result;
	}

	async addAvatar(avid, name) {
		if (this.hasAvatar(avid)) throw new Error("This avatar has already been added");

		this._avatars[avid] = new BoardAvatar({
			name,
			controls: {},
			controlOrder: [],
		});

		await this._store();
	}

	async removeAvatar(avid) {
		if (!this.hasAvatar(avid)) throw new Error("This avatar is not part of this board");

		delete this._avatars[avid];

		await this._store();
	}

	async removeMissingIcons() {
		let performed_change = false;

		for (let avid in this._avatars) {
			for (const control of this._avatars[avid].getControls()) {
				if (!this._iconManager.iconExists(control.icon)) {
					control.unsetIcon();
					performed_change = true;
				}
			}
		}

		if (performed_change) {
			await this._store();
		}
	}

	constructControl({ avid, id, parameterName, dataType, controlType, setValue, defaultValue, label=null, icon=null }) {
		if (!this.hasAvatar(avid)) throw new Error("This avatar is not part of this board");

		// this also performs validation
		const parameterControl = new AvatarParamControl({
			id,
			parameterName,
			dataType,
			controlType,
			setValue,
			defaultValue,
			label,
			icon,
		});

		return parameterControl;
	}

	async createControl({ avid, dataType, controlType, setValue, defaultValue, parameter, label=null, icon=null }) {
		await this._avatarManager.registerNewParameter({
			avid,
			paramName: parameter.name,
			inputAddress: parameter.inputAddress,
			outputAddress: parameter.outputAddress,
		});

		const parameterControl = this.constructControl({
			avid,
			id: uuiv4(), // new random id 
			parameterName: parameter.name, 
			dataType, 
			controlType, 
			setValue, 
			defaultValue,
			label,
			icon
		});

		this._avatars[avid].addControl(parameterControl);

		await this._store();

		return parameterControl;
	}

	async removeControl(avid, id) {
		if (!this.hasControl(avid, id)) {
			throw new Error("This control was not found on this board for this avatar");
		}

		this._avatars[avid].removeControl(id);

		await this._store();
	}

	async updateControl(avid, parameterControl) {
		if (!this.hasControl(avid, parameterControl.id)) {
			throw new Error("This control was not found on this board for this avatar");
		}

		this._avatars[avid].updateControl(parameterControl);

		await this._store();
	}

	async duplicateControl(avid, id) {
		const sourceControl = this.getControl(avid, id);

		const duplicatedControl = new AvatarParamControl({
			...sourceControl.serialize(),
			id: uuiv4(), // new random id 
		});

		this._avatars[avid].addControl(duplicatedControl, this._avatars[avid].getControlOrderedPosition(id) + 1);

		await this._store();
	}

	async setControlOrder(avid, controlOrder) {
		if (!this.hasAvatar(avid)) {
			throw new Error("Invalid avatar id");
		}

		this._avatars[avid].setControlOrder(controlOrder);

		await this._store();
	}

	getName() {
		return this._name;
	}

	async setName(name) {
		this._name = name;
		await this._store();
	}
}

module.exports = { Board };