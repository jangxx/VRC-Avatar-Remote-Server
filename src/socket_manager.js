const { Server } = require("socket.io");

const { VrcAvatarManager } = require("./vrc_avatar_manager");
const { BoardManager } = require("./board_manager");

class SocketManager {
	/**
	 * 
	 * @param {Server} io 
	 * @param {BoardManager} boardManager
	 * @param {VrcAvatarManager} avatarManager 
	 */
	constructor(io, boardManager, avatarManager) {
		this._io = io;
		this._boardManager = boardManager;
		this._avatarManager = avatarManager;

		this._sockets = {};
	}

	_addSocket(socket) {
		const board = this._boardManager.getBoard(socket.data.boardId);

		this._sockets[socket.id] = {
			socket,
			board,
			params: []
		};

		console.log(`Add socket ${socket.id} for board ${board.id}`);

		socket.join(`board::${board.id}`); // join room for board update notifications

		// put the socket in all the correct rooms
		for (let p of board.getAllParametersOfAllAvatars()) {
			const key = `parameter::${p.avatar}::${p.parameter}`;
			socket.join(key); // join the parameters room
		}

		// msg = { avatar, controlId, value }
		socket.on("set-parameter", (msg, callback) => {
			if (msg == undefined || typeof msg !== "object" || !("avatar" in msg && "controlId" in msg && "value" in msg)) {
				return callback({ success: false, error: "Invalid data" });
			}

			if (!board.hasControl(msg.avatar, msg.controlId)) {
				return callback({ success: false, error: "Control doesn't exist" });
			}

			if (msg.avatar != this._avatarManager.getCurrentAvatarId()) {
				return callback({ success: false, error: "This avatar is not currently active" });
			}

			const paramController = board.getControl(msg.avatar, msg.controlId);
			paramController.setValue(this._avatarManager, msg.value).then(() => {
				callback({ success: true });
			}, err => {
				callback({ success: false, error: err.message });
			});
		});

		// msg = { avatar, controlId }
		socket.on("perform-action", (msg, callback) => {
			if (msg == undefined || typeof msg !== "object" || !("avatar" in msg && "controlId" in msg)) {
				return callback({ success: false, error: "Invalid data" });
			}

			if (!board.hasControl(msg.avatar, msg.controlId)) {
				return callback({ success: false, error: "Parameter doesn't exist" });
			}

			const paramController = board.getControl(msg.avatar, msg.controlId);
			paramController.performAction(this._avatarManager).then(() => {
				callback({ success: true });
			}, err => {
				callback({ success: false, error: err.message });
			});
		});

		// emit an initial avatar event if neccessary
		const currentAvatar = this._avatarManager.getCurrentAvatarId();
		if (board.hasAvatar(currentAvatar)) {
			socket.emit("avatar", { id: currentAvatar });

			for (let p of board.getParametersForAvatar(currentAvatar)) {
				socket.emit("parameter", {
					name: p.parameter,
					avatar: p.avatar,
					value: this._avatarManager.getParameter(p.parameter),
				});
			}
		}
	}

	_removeSocket(socket) {
		delete this._sockets[socket.id];
	}

	init() {
		// evt = { name, value, avatar }
		this._avatarManager.on("parameter", evt => {
			const key = `parameter::${evt.avatar}::${evt.name}`;
			
			this._io.to(key).emit("parameter", evt);
		});

		// evt = { id }
		this._avatarManager.on("avatar", evt => {
			for (let socketId in this._sockets) {
				if (this._sockets[socketId].board.hasAvatar(evt.id)) {
					this._sockets[socketId].socket.emit("avatar", evt);
				} else {
					this._sockets[socketId].socket.emit("avatar", null); // tell this socket that we are now in an unknown avatar
				}
			}
		});

		this._io.on("connection", socket => {
			this._addSocket(socket);

			socket.on("disconnect", () => {
				this._removeSocket(socket);
			});
		});
	}

	boardUpdate(board_id) {
		this._io.to(`board::${board_id}`).emit("board-update");
	}
}

module.exports = { SocketManager };