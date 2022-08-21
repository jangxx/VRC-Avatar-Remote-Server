const { v4: uuiv4 } = require("uuid");

const { Config } = require("./config");
const { IconManager } = require("./icon_manager");
const { Board } = require("./board");

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

		board.on("store-config", () => {
			this._handleBoardUpdate(board.id);
		});

		return board;
	}

	async duplicateBoard(id) {
		const board = this.getBoard(id);

		const newId = uuiv4();
		const duplicateBoard = new Board(newId, this._config, this._avatarManager, this._iconManager);
		duplicateBoard._deserialize(board.serialize());

		// prepend a "Copy of" to the name
		duplicateBoard._name = "Copy of " + duplicateBoard._name;

		// generate new ids for all controls
		duplicateBoard._generateNewControlIds();
		await duplicateBoard._store();

		duplicateBoard.on("store-config", () => {
			this._handleBoardUpdate(duplicateBoard.id);
		});

		return duplicateBoard;
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