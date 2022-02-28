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
	}

	_removeSocket(socket) {
		for (let param of this._sockets[socket.id].params) {
			this._subscriptions[param] = this._subscriptions[param].filter(s => s.id != socket.id);
		}

		delete this._sockets[socket.id];
	}

	init() {
		this._avatarManager.on("parameter", evt => {
			// TODO: send the parameter update out to all subscribed sockets
		});

		this._avatarManager.on("avatar", evt => {
			// TODO: check if the board the socket is in has this avatar and update it
		});

		io.on("connection", socket => {
			this._addSocket(socket);

			socket.on("disconnect", () => {
				this._removeSocket(socket);
			});
		});
	}
}

module.exports = { SocketManager };