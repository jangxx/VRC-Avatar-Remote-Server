const { v4: uuiv4 } = require("uuid");
const bcrypt = require("bcrypt");

const { Config } = require("./config");
const { AvatarParamControl } = require("./avatar_param_control");

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
		this._avatars = {}; // each object contains the different parameter controls that are set up
	}

	get id() {
		return this._id;
	}

	_serialize() {
		function serializeAvatar(avi_def) {
			const serialized = {
				controls: avi_def.controls.map(control => control._serialize()),
			};
			return serialized;
		}

		return {
			password: this._password,
			avatars: Object.fromEntries(
				Object.entries(this._avatars).map(elem => [elem[0], serializeAvatar(elem[1])] )
			),
		};
	}

	async _store() {
		await this._config.setKey("boards", this.id, this._serialize());
	}

	_load() {
		function deserializeAvatar(avi_def) {
			const deserialized = {
				controls: avi_def.controls.map(control => new AvatarParamControl(control)),
			};
			return deserialized;
		}

		const boardDef = this._config.getKey("boards", this.id);

		this._password = boardDef.password;

		this._avatars = Object.fromEntries(
			Object.entries(boardDef.avatars).map(elem => [elem[0], deserializeAvatar(elem[1])] )
		);
	}

	hasPassword() {
		return this._password === null;
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

	hasParameter(avid, paramName) {
		return this.hasAvatar(avid) && paramName in this._avatars[avid].controls;
	}

	getParameter(avid, paramName) {
		if (!this.hasParameter(avid, paramName)) {
			throw new Error("This parameter was not found on this board for this avatar");
		}

		return this._avatars[avid].controls[paramName].clone();
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
}

module.exports = { BoardManager, Board };