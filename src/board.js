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
		function serializeAvatar(avi_def) {
			const serialized = {
				controls: Object.fromEntries(
					Object.entries(avi_def.controls).map(c => [c[0], c[1].serialize()] )
				),
				name: avi_def.name,
				controlOrder: fixControlOrder(avi_def.controlOrder, Object.keys(avi_def.controls)),
			};
			return serialized;
		}

		return {
			password: (!external) ? this._password : (this._password !== null),
			name: this._name,
			avatars: Object.fromEntries(
				Object.entries(this._avatars).map(elem => [(mask_ids) ? this._avatarManager.hashAvatarId(elem[0]) : elem[0], serializeAvatar(elem[1])] )
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
		function deserializeAvatar(avi_def) {
			const deserialized = {
				controls: Object.fromEntries(
					Object.entries(avi_def.controls).map(c => {
						if (verifyMode) {
							console.log(`Validating avatar control ${c[0]}`);
						}
						
						return [
							c[0], 
							new AvatarParamControl({ ...c[1], id: c[0] })
						];
					})
				),
				name: avi_def.name,
				controlOrder: fixControlOrder(avi_def.controlOrder, Object.keys(avi_def.controls)),
			};
			return deserialized;
		}

		this._password = boardDef.password;
		this._name = boardDef.name;

		this._avatars = Object.fromEntries(
			Object.entries(boardDef.avatars).map(elem => {
				if (verifyMode) {
					console.log(`Validating avatar ${elem[0]}`);
				}
				return [elem[0], deserializeAvatar(elem[1])];
			})
		);
	}

	// only needed for the duplicate functionality
	_generateNewControlIds() {
		for (let avid in this._avatars) {
			for (let controlId in this._avatars[avid].controls) {
				const newControlId = uuiv4();
				this._avatars[avid].controls[newControlId] = this._avatars[avid].controls[controlId];
				delete this._avatars[avid].controls[controlId];
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
		return this.hasAvatar(avid) && id in this._avatars[avid].controls;
	}

	getControl(avid, id) {
		if (!this.hasControl(avid, id)) {
			throw new Error("This control was not found on this board for this avatar");
		}

		return this._avatars[avid].controls[id].clone();
	}

	getParametersForAvatar(avid) {
		const avParams = new Set();
		for (let controlId in this._avatars[avid].controls) {
			avParams.add(this._avatars[avid].controls[controlId].parameterName);
		}

		return [...avParams].map(parameter => {
			return { avatar: avid, parameter };
		});
	}

	getAllParametersOfAllAvatars() {
		let result = [];
		for (let avid in this._avatars) {
			const avParams = new Set();
			for (let controlId in this._avatars[avid].controls) {
				avParams.add(this._avatars[avid].controls[controlId].parameterName);
			}

			result = result.concat([...avParams].map(parameter => {
				return { avatar: avid, parameter };
			}));
		}
		return result;
	}

	async addAvatar(avid, name) {
		if (this.hasAvatar(avid)) throw new Error("This avatar has already been added");

		this._avatars[avid] = {
			controls: {},
			name,
		};

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
			for (let controlId in this._avatars[avid].controls) {
				const control = this._avatars[avid].controls[controlId];
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

		this._avatars[avid].controls[parameterControl.id] = parameterControl;
		this._avatars[avid].controlOrder.push(parameterControl.id);

		await this._store();

		return parameterControl;
	}

	async removeControl(avid, id) {
		if (!this.hasControl(avid, id)) {
			throw new Error("This control was not found on this board for this avatar");
		}

		delete this._avatars[avid].controls[id];
		this._avatars[avid].controlOrder = this._avatars[avid].controlOrder.filter(cid => cid !== id);

		await this._store();
	}

	async updateControl(avid, parameterControl) {
		if (!this.hasControl(avid, parameterControl.id)) {
			throw new Error("This control was not found on this board for this avatar");
		}

		this._avatars[avid].controls[parameterControl.id] = parameterControl;

		await this._store();
	}

	async setControlOrder(avid, controlOrder) {
		// make sure that the ids in controlOrder are all correct
		for (const cid of controlOrder) {
			if (!this.hasControl(avid, cid)) {
				throw new Error("Invalid control id");
			}
		}

		if (controlOrder.length !== Object.keys(this._avatars[avid].controls).length) {
			throw new Error("Order is missing some controls");
		}

		this._avatars[avid].controlOrder = controlOrder;

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