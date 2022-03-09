const { v4: uuiv4 } = require("uuid");
const bcrypt = require("bcrypt");

const { Config } = require("./config");
const {BackendAvatarParamControl: AvatarParamControl } = require("./backend_avatar_param_control");

class Board {
	/**
	 * 
	 * @param {string} id 
	 * @param {Config} config 
	 */
	constructor(id, config) {
		this._id = id;
		this._config = config;

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
				Object.entries(this._avatars).map(elem => [elem[0], serializeAvatar(elem[1])] )
			),
		};
	}

	async _store() {
		await this._config.setKey("boards", this.id, this.serialize());
	}

	_load() {
		function deserializeAvatar(avi_def) {
			const deserialized = {
				controls: Object.fromEntries(
					Object.entries(avi_def.controls).map(c => [
						c[0], 
						new AvatarParamControl({ ...c[1], id: c[0] })
					])
				),
				name: avi_def.name,
			};
			return deserialized;
		}

		const boardDef = this._config.getKey("boards", this.id);

		this._password = boardDef.password;
		this._name = boardDef.name;

		this._avatars = Object.fromEntries(
			Object.entries(boardDef.avatars).map(elem => [elem[0], deserializeAvatar(elem[1])] )
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

	hasParameter(avid, id) {
		return this.hasAvatar(avid) && id in this._avatars[avid].controls;
	}

	getParameter(avid, id) {
		if (!this.hasParameter(avid, id)) {
			throw new Error("This parameter was not found on this board for this avatar");
		}

		return this._avatars[avid].controls[id].clone();
	}

	getParametersForAvatar(avid) {
		const avParams = new Set();
		for (let controlId in this._avatars[avid].controls) {
			avParams.add(this._avatars[avid].controls[controlId].name);
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
				avParams.add(this._avatars[avid].controls[controlId].name);
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

	constructParameter(avid, id, name, dataType, controlType, setValue, defaultValue) {
		if (!this.hasAvatar(avid)) throw new Error("This avatar is not part of this board");

		// this also performs validation
		const parameterControl = new AvatarParamControl({
			id,
			name,
			dataType,
			controlType,
			setValue,
			defaultValue
		});

		return parameterControl;
	}

	async createParameter(avid, name, dataType, controlType, setValue, defaultValue) {
		const parameterControl = this.constructParameter(
			avid,
			uuiv4(), // new random id 
			name, 
			dataType, 
			controlType, 
			setValue, 
			defaultValue);

		this._avatars[avid].controls[parameterControl.id] = parameterControl;

		await this._store();

		return parameterControl;
	}

	async removeParameter(avid, id) {
		if (!this.hasParameter(avid, id)) {
			throw new Error("This parameter was not found on this board for this avatar");
		}

		delete this._avatars[avid].controls[id];

		await this._store();
	}

	async updateParameter(avid, parameterControl) {
		if (!this.hasParameter(avid, parameterControl.id)) {
			throw new Error("This parameter was not found on this board for this avatar");
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
	 */
	constructor(config) {
		this._config = config;
	}

	boardExists(id) {
		return this._config.existsKey("boards", id);
	}

	async createBoard() {
		const id = uuiv4();
		const board = new Board(id, this._config);
		await board._store();
		return board;
	}

	getBoard(id) {
		if (!this.boardExists(id)) {
			throw new Error("This board doesn't exist");
		}

		const board = new Board(id, this._config);
		board._load();
		return board;
	}

	getAllBoardIds() {
		return Object.keys(this._config.getKey("boards"));
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
	}
}

module.exports = { BoardManager, Board, requireBoard };