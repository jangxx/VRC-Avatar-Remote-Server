const { EventEmitter } = require("events");

const { v4: uuiv4 } = require("uuid");
const bcrypt = require("bcrypt");

const { sha1 } = require("./utils");
const { Config } = require("./config");
const { IconManager } = require("./icon_manager");
const { VrcAvatarManager } = require("./vrc_avatar_manager");
const { BackendAvatarParamControl: AvatarParamControl } = require("./backend_avatar_param_control");

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

	serialize(external = false) {
		function serializeAvatar(avi_def) {
			const serialized = {
				controls: Object.fromEntries(
					Object.entries(avi_def.controls).map(c => [c[0], c[1].serialize()] )
				),
				name: avi_def.name,
			};
			return serialized;
		}

		return {
			password: (!external) ? this._password : (this._password !== null),
			name: this._name,
			avatars: Object.fromEntries(
				Object.entries(this._avatars).map(elem => [(!external) ? elem[0] : this._avatarManager.hashAvatarId(elem[0]), serializeAvatar(elem[1])] )
			),
		};
	}

	async _store() {
		await this._config.setKey("boards", this.id, this.serialize());
		this.emit("store-config");
	}

	_load(verifyMode) {
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
			};
			return deserialized;
		}

		const boardDef = this._config.getKey("boards", this.id);

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

		await this._store();

		return parameterControl;
	}

	async removeControl(avid, id) {
		if (!this.hasControl(avid, id)) {
			throw new Error("This control was not found on this board for this avatar");
		}

		delete this._avatars[avid].controls[id];

		await this._store();
	}

	async updateControl(avid, parameterControl) {
		if (!this.hasControl(avid, parameterControl.id)) {
			throw new Error("This control was not found on this board for this avatar");
		}

		this._avatars[avid].controls[parameterControl.id] = parameterControl;

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

class BoardManager {
	/**
	 * 
	 * @param {Config} config
	 * @param {IconManager} iconManager
	 */
	constructor(config, avatarManager, iconManager) {
		this._config = config;
		this._iconManager = iconManager;
		this._avatarManager = avatarManager;
		this._socketManager = null; // has to be registered by the socketmanager to avoid the circular dependency
	}

	_handleBoardUpdate(board_id) {
		if (this._socketManager !== null) {
			this._socketManager.boardUpdate(board_id);
		}
	}

	boardExists(id) {
		if (id === "default") {
			const defaultId = this.getDefaultBoardId();
			return defaultId ? this._config.existsKey("boards", defaultId) : false;
		} else {
			return this._config.existsKey("boards", id);
		}
	}

	async createBoard() {
		const id = uuiv4();
		const board = new Board(id, this._config, this._avatarManager, this._iconManager);
		await board._store();
		return board;
	}

	getDefaultBoardId() {
		return this._config.getKey("defaultBoard");
	}

	async setDefaultBoardId(board_id) {
		await this._config.setKey("defaultBoard", board_id);
	}

	getBoard(id, verifyMode=false) {
		if (!this.boardExists(id)) {
			throw new Error("This board doesn't exist");
		}

		if (id === "default") { // at this point we know it exists so no null check necessary
			id = this.getDefaultBoardId();
		}

		const board = new Board(id, this._config, this._avatarManager, this._iconManager);
		board._load(verifyMode);

		board.on("store-config", () => {
			this._handleBoardUpdate(board.id);
		});

		return board;
	}

	async deleteBoard(id) {
		if (!this.boardExists(id)) {
			throw new Error("This board doesn't exist");
		}

		await this._config.unsetKey("boards", id);
	}

	resolveHashedAvatarId(avid_h) {
		const avid = this._avatarManager.unhashAvatarId(avid_h);
		return (avid) ? avid : null;
	}


	getAllBoardIds() {
		return Object.keys(this._config.getKey("boards"));
	}

	// try to load all boards from the config in order to throw an exception right at the start of the server
	tryLoadingAllBoards() {
		for (let boardId of this.getAllBoardIds()) {
			console.log(`Validating board ${boardId}`);
			this.getBoard(boardId, true);
		}
	}

	async removeAllMissingIcons() {
		for (let boardId of this.getAllBoardIds()) {
			await this.getBoard(boardId).removeMissingIcons();
		}
	}

	registerSocketManager(socketManager) {
		this._socketManager = socketManager;
	}
}

function requireBoard(paramName, boardManager) {
	return function(req, res, next) {
		if (!(paramName in req.params)) {
			console.error(`${paramName} missing from req.params?`);
			const err = new Error();
			err.statusCode = 500;
			return next(err);
		}

		if (!boardManager.boardExists(req.params[paramName])) {
			const err = new Error();
			err.statusCode = 404;
			return next(err);
		}

		req.board = boardManager.getBoard(req.params[paramName]);
		return next();
	};
}

module.exports = { BoardManager, Board, requireBoard };