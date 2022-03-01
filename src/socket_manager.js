const { VrcAvatarManager } = require("./vrc_avatar_manager");
const { Server } = require("socket.io");
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

		this._subscriptions = {};
		this._sockets = {};
	}

	_addSocket(socket) {
		const board = this._boardManager.getBoard(socket.data.boardId)

		this._sockets[socket.id] = {
			socket,
			board,
			params: []
		};

		// msg = { avatar, parameter }
		socket.on("subscribe", msg => {
			if (board.hasParameter(msg.avatar, msg.parameter)) {
				const key = `${msg.avatar}::${msg.parameter}`;

				if (!(key in this._subscriptions)) {
					this._subscriptions[key] = [];
				}

				this._subscriptions[key].push(socket);
			}
		});

		// msg = { avatar, controlId, value }
		socket.on("set-parameter", (msg, callback) => {
			if (!board.hasParameter(msg.avatar, msg.parameter)) {
				return callback({ success: false, error: "Parameter doesn't exist" });
			}

			const paramController = board.getParameter(msg.avatar, msg.controlId);
			paramController.setValue(this._avatarManager, msg.value).then(() => {
				callback({ success: true });
			}, err => {
				callback({ success: false, error: err.message });
			});
		});

		// msg = { avatar, controlId }
		socket.on("perform-action", (msg, callback) => {
			if (!board.hasParameter(msg.avatar, msg.parameter)) {
				return callback({ success: false, error: "Parameter doesn't exist" });
			}

			const paramController = board.getParameter(msg.avatar, msg.controlId);
			paramController.performAction(this._avatarManager).then(() => {
				callback({ success: true });
			}, err => {
				callback({ success: false, error: err.message });
			});
		});
	}

	_removeSocket(socket) {
		for (let param of this._sockets[socket.id].params) {
			this._subscriptions[param] = this._subscriptions[param].filter(s => s.id != socket.id);
		}

		delete this._sockets[socket.id];
	}

	init() {
		this._avatarManager.on("parameter", evt => {
			const key = `${evt.avatar}::${evt.name}`;

			if (!(key in this._subscriptions)) return;

			for (let socket of this._subscriptions[key]) {
				socket.emit("parameter", evt);
			}
		});

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
}

module.exports = { SocketManager };