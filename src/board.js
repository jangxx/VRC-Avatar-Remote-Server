const { EventEmitter } = require("events");
const bcrypt = require("bcrypt");
const { v4: uuiv4 } = require("uuid");

const { Config } = require("./config");
const { IconManager } = require("./icon_manager");
const { VrcAvatarManager } = require("./vrc_avatar_manager");
const { BackendAvatarParamControl: AvatarParamControl } = require("./backend_avatar_param_control");

/**
 * Automatically create and manage the groups to be backwards compatible
 */
function fixAvatarGroups(avatar_groups, all_control_ids, legacy_controlOrder) {
	const ids = new Set(all_control_ids);
	const result_groups = {};

	if (avatar_groups) {
		for (const groupId in avatar_groups) {
			// only include ids that actually exist
			const valid_controls = avatar_groups[groupId].controls.filter(cid => ids.has(cid));
			result_groups[groupId] = new BoardAvatarGroup({ ...avatar_groups[groupId], controls: valid_controls });

			for (const controlId of result_groups[groupId].controls) {
				ids.delete(controlId);
			}
		}
	}

	// this will be called if the default group was accidentally deleted or if we are migrating from a non-groups avatar
	if (!("default" in result_groups)) {
		result_groups["default"] = new BoardAvatarGroup({ name: null, controls: [] });
	}

	// if the old controlOrder list still exists, we use it for the remaining ungrouped ids
	let ids_ordered = [...ids];

	if (legacy_controlOrder && Array.isArray(legacy_controlOrder)) {
		ids_ordered = legacy_controlOrder.filter(cid => ids.has(cid)); // only add valid control ids
		const legacyIdsSet = new Set(ids_ordered);
		ids_ordered = ids_ordered.concat([...ids].filter(cid => !legacyIdsSet.has(cid))); // append the rest of the ids
	}

	// add the remaining ids to the end of the default group
	for (const controlId of ids_ordered) {
		result_groups["default"].addControl(controlId);
	}

	return result_groups;
}

/**
 * Automatically create and manage the group order in case the config file was changed externally
 */
function fixAvatarGroupOrder(group_order, all_group_ids) {
	const ids = new Set(all_group_ids);

	if (group_order) {
		// remove entries that are in the order but not in the groups (TODO: this could also be a validation error?)
		group_order = group_order.filter(gid => ids.has(gid));

		for (const gid of group_order) {
			ids.delete(gid);
		}
	} else {
		group_order = [];
	}

	if (ids.has("default")) {
		ids.delete("default");
		return [ "default", ...group_order, ...ids ];
	} else {
		return [ ...group_order, ...ids ]; // just append the non ordered ids at the end
	}	
}

class BoardAvatarGroup {
	constructor(definition) {
		this._name = definition.name; // allow null and empty string as name

		this._controls = definition.controls;
	}

	get name() { return this._name; }

	get controls() {
		return this._controls;
	}

	serialize() {
		return {
			name: this.name,
			controls: this.controls,
		};
	}

	addControl(id, position = null) {
		if (position === null) {
			this._controls.push(id);
		} else {
			this._controls.splice(position, 0, id);
		}
	}

	removeControl(id) {
		if (!this._controls.includes(id)) {
			throw new Error(`This group does not contain control ${id}`);
		}
		this._controls = this._controls.filter(cid => cid !== id);
	}

	hasControl(id) {
		return this._controls.includes(id);
	}

	getControlPosition(id) {
		return this._controls.findIndex(cid => cid === id);
	}

	setControlOrder(order) {
		// first verify that order only contains valid control ids
		if (order.length != this._controls.length || new Set(this._controls.concat(order)).size != this._controls.length) {
			throw new Error("Order definition is not valid (ids don't match the ones currently in the group");
		}

		this._controls = order;
	}

	update({ name }) {
		if (name === null) {
			throw new Error("Group name may not be null");
		}

		this._name = name;
	}
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

		this._groups = fixAvatarGroups(definition.groups, Object.keys(this._controls), definition.controlOrder);
		this._groupOrder = fixAvatarGroupOrder(definition.groupOrder, Object.keys(this._groups));
		
		this._controlGroups = {}; // lookup list to find the group for each control faster
		for (const groupId in this._groups) {
			for (const controlId of this._groups[groupId].controls) {
				this._controlGroups[controlId] = groupId;
			}
		}
	}

	get name() { return this._name; }
	get groups() { return this._groups; }

	serialize() {
		return {
			name: this.name,
			groupOrder: this._groupOrder,
			groups: Object.fromEntries(
				Object.entries(this._groups).map(g => [g[0], g[1].serialize()])
			),
			controls: Object.fromEntries(
				Object.entries(this._controls).map(c => [c[0], c[1].serialize()])
			),
		}
	}

	getControls() {
		return Object.values(this._controls);
	}

	getControl(id) {
		if (!(id in this._controls)) {
			throw new Error(`No control with id ${id} exists on this avatar`);
		}
		return this._controls[id];
	}

	hasControl(id) {
		return id in this._controls;
	}

	getGroupForControl(id) {
		if (!(id in this._controls)) {
			throw new Error(`No control with id ${id} exists on this avatar`);
		}
		return this._controlGroups[id];
	}

	// overwrite
	updateControl(control) {
		if (!(control.id in this._controls)) {
			throw new Error(`No control with id ${control.id} exists on this avatar`);
		}
		this._controls[control.id] = control;
	}

	addControl(control, group = null, position = null) {
		this._controls[control.id] = control;

		if (group === null) {
			group = "default";
		}

		this._groups[group].addControl(control.id, position);
		this._controlGroups[control.id] = group;
	}

	removeControl(id) {
		if (!(id in this._controls)) {
			throw new Error(`No control with id ${id} exists on this avatar`);
		}
		delete this._controls[id];

		this._groups[this._controlGroups[id]].removeControl(id);
		delete this._controlGroups[id];
	}

	replaceControl(id, control) {
		const currentGroup = this._controlGroups[id];
		const currentOrderPos = this._groups[currentGroup].getControlPosition(id);
		this.removeControl(id);
		this.addControl(control, currentGroup, currentOrderPos); // splice it into the same position in the same group
	}

	getGroup(id) {
		if (!(id in this._groups)) {
			throw new Error(`No group with id ${id} exists on this avatar`);
		}
		return this._groups[id];
	}

	createGroup({ name }) {
		const groupId = uuiv4();
		this._groups[groupId] = new BoardAvatarGroup({
			name,
			controls: [],
		});
		this._groupOrder.push(groupId);

		return groupId;
	}

	removeGroup(id) {
		if (!(id in this._groups)) {
			throw new Error(`No group with id ${id} exists on this avatar`);
		}

		if (id === "default") {
			throw new Error("The default group can not be removed");
		}

		// append all controls from this group back to the default group
		const group = this._groups[id];
		group.controls.forEach(controlId => {
			this._groups["default"].addControl(controlId);
			this._controlGroups[controlId] = "default";
		});
		delete this._groups[id];

		this._groupOrder = this._groupOrder.filter(gid => gid !== id);
	}

	setControlGroup(id, groupId, position = null) {
		if (!(id in this._controls)) {
			throw new Error(`No control with id ${id} exists on this avatar`);
		}

		if (!(groupId in this._groups)) {
			throw new Error(`No group with id ${groupId} exists on this avatar`);
		}

		const previousGroup = this.getGroupForControl(id);
		this._groups[previousGroup].removeControl(id);

		this._groups[groupId].addControl(id, position);
		this._controlGroups[id] = groupId;
	}

	setGroupOrder(order) {
		// first verify that order only contains valid group ids
		const groupIds = Object.keys(this._groups);

		if (order.length != groupIds.length || new Set(groupIds.concat(order)).size != groupIds.length) {
			throw new Error("Order definition is not valid (ids don't match the ones currently on the avatar");
		}

		this._groupOrder = order;
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
			groups: {},
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

		const groupId = this._avatars[avid].getGroupForControl(id);
		const groupPosition = this._avatars[avid].groups[groupId].getControlPosition(id);

		this._avatars[avid].addControl(duplicatedControl, groupId, groupPosition + 1);

		await this._store();
	}

	async setGroupControlOrder(avid, groupId, controlOrder) {
		const group = this.getGroup(avid, groupId);
		group.setControlOrder(controlOrder);

		await this._store();
	}

	async setGroupOrder(avid, groupOrder) {
		if (!this.hasAvatar(avid)) {
			throw new Error("Invalid avatar id");
		}

		this._avatars[avid].setGroupOrder(groupOrder);

		await this._store();
	}

	async createGroup({ avid, name }) {
		if (!this.hasAvatar(avid)) {
			throw new Error("Invalid avatar id");
		}

		const groupId = this._avatars[avid].createGroup({ name });

		await this._store();

		return groupId;
	}

	async removeGroup(avid, id) {
		if (!this.hasAvatar(avid)) {
			throw new Error("Invalid avatar id");
		}

		if (!(id in this._avatars[avid].groups)) {
			throw new Error("Invalid group id");
		}

		this._avatars[avid].removeGroup(id);

		await this._store();
	}

	getGroup(avid, groupId) {
		if (!this.hasAvatar(avid)) {
			throw new Error("Invalid avatar id");
		}

		return this._avatars[avid].getGroup(groupId);
	}

	async updateGroup(avid, groupId, { name }) {
		const group = this.getGroup(avid, groupId);
		group.update({ name });

		await this._store();
	}

	async setControlGroup(avid, id, groupId, position = null) {
		if (!this.hasAvatar(avid)) {
			throw new Error("Invalid avatar id");
		}

		this._avatars[avid].setControlGroup(id, groupId, position);

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