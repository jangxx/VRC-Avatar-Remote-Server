const { createServer } = require("http");

const express = require("express");
const expressSession = require("express-session");
const MemoryStore = require("memorystore")(expressSession);
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const prompt = require("prompt");
prompt.message = "";
prompt.delimiter = "";

const { Config } = require("./src/config");
const { OscManager } = require("./src/osc_manager");
const { VrcAvatarManager } = require("./src/vrc_avatar_manager");
const { BoardManager, requireBoard } = require("./src/board_manager");
const { SocketManager } = require("./src/socket_manager");
const { requireLogin, requireLoginSocketIO, requireLoginInternal, requireAdmin } = require("./src/require_login");
const run = require("./src/express_async_middleware");

if (process.argv.length < 3) {
	console.log("Usage: node index.js <config.yml>");
	process.exit(0);
}

const config = new Config(process.argv[2]);
const oscManager = new OscManager(config);
const avatarManager = new VrcAvatarManager(oscManager);
const boardManager = new BoardManager(config);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const socketManager = new SocketManager(io, boardManager, avatarManager);

async function main() {
	await config.init();

	if (config.getRequiredKey("admin", "password") === null) {
		prompt.start({ noHandleSIGINT: true });
		console.log("You need to set an admin password before using this tool. Please enter it now.");

		while (true) {
			const pw = await prompt.get({
				properties: {
					password: {
						hidden: true,
						replace: "*",
						message: "Password:"
					},
					repassword: {
						hidden: true,
						replace: "*",
						message: "Retype password:"
					}
				}
			});
			
			if (pw.password != pw.repassword) {
				console.log("The passwords do not match! Please retry.")
			} else {
				const hash = await bcrypt.hash(pw.password, 10);
				await config.setKey("admin", "password", hash);
				break;
			}
		}
	}

	const sessionMiddleware = expressSession({
		secret: config.getRequiredKey("server", "sessionSecret"),
		store: new MemoryStore({
			checkPeriod: 86400000, // every 24h
		}),
		resave: false,
		cookie: { maxAge: 86400000 },
		saveUninitialized: false,
	});

	app.set('trust proxy', 1);
	app.use(sessionMiddleware);
	app.use(express.json());

	io.use((socket, next) => {
		sessionMiddleware(socket.request, {}, next);
	});

	io.use((socket, next) => {
		requireLoginSocketIO(socket.request, {}, next);
	});

	io.use((socket, next) => {
		socket.data.boardId = socket.request.query.target;
		next();
	});

	app.post("/api/login/:target", run(async function(req, res) {
		if (!("password" in req.body)) {
			return res.sendStatus(400);
		}

		let check_result;
		if (req.params.target !== "admin") {
			if (!boardManager.boardExists(req.params.target)) {
				return res.sendStatus(404);
			}

			const board = boardManager.getBoard(req.params.target);

			if (!board.hasPassword()) {
				return res.sendStatus(400); // there is no password set up for this board
			}

			check_result = await board.checkPassword(req.body.password);
		} else {
			checkHash = config.getKey("admin", "password");
			check_result = await bcrypt.compare(req.body.password, checkHash);
		}

		if (!check_result) {
			return res.json({ success: false });
		}

		if (!("logins" in req.session)) {
			req.session.logins = {};
		}

		req.session.logins[req.params.target] = {
			loggedIn: true,
		};
		req.session.save();

		return res.json({ success: true });
	}));

	app.get("/api/login/:target", run(async function(req, res) {
		if (req.params.target !== "admin" && !boardManager.boardExists(req.params.target)) {
			return res.sendStatus(404);
		}

		let hasPassword;
		if (req.params.target === "admin") {
			hasPassword = true;
		} else {
			const board = boardManager.getBoard(req.params.target);
			hasPassword = board.hasPassword();
		}

		if (!("logins" in req.session)) {
			req.session.logins = {};
		}

		if (!hasPassword) { // no password required for this board, just set a login cookie
			req.session.logins[req.params.target] = {
				loggedIn: true,
			};
			req.session.save();
			return res.json({ loggedIn: true });
		} else {
			return res.json({ loggedIn: requireLoginInternal(req.params.target, req.session) });
		}
	}));

	/**
	 * Board router
	 */

	const boardRouter = express.Router();

	boardRouter.use(requireLogin("board"), requireBoard("board", boardManager));

	boardRouter.get("/full", function(req, res) {
		return res.json({
			board: req.board.serialize()
		});
	});

	boardRouter.get("/controls", function(req, res) {
		return res.json({
			controls: req.board.serialize().controls
		});
	});

	app.use("/api/b/:board", boardRouter);

	/**
	 * Admin router
	 */

	const adminRouter = express.Router();

	adminRouter.use(requireAdmin);

	adminRouter.get("/boards", function(req, res) {
		return res.json({
			boards: Object.fromEntries(
				boardManager.getAllBoardIds().map(boardId => [
					boardId,
					boardManager.getBoard(boardId)
				])
			)
		});
	});

	adminRouter.post("/create-board", run(async function(req, res) {
		const board = await boardManager.createBoard();

		return res.json({
			board: board.serialize(),
		});
	}));

	adminRouter.post("/b/:board/create-parameter", requireBoard("board", boardManager), run(async function(req, res) {
		if (!("parameter" in req.body)) {
			return res.sendStatus(400);
		}

		if (!("name" in req.body.parameter && "avatar" in req.body.parameter)) {
			return res.sendStatus(400);
		}

		let parameter;
		try {
			parameter = await req.board.createParameter(
				req.body.parameter.avatar,
				req.body.parameter.name,
				req.body.parameter.dataType,
				req.body.parameter.controlType,
				req.body.parameter.setValue,
				req.body.parameter.defaultValue,
			);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		return res.json({
			parameter: parameter.serialize(),
		});
	}));

	adminRouter.delete("/b/:board/:avatarId/:parameterId", requireBoard("board", boardManager), run(async function(req, res) {
		try {
			await req.board.removeParameter(req.params.avatarId, req.params.parameterId);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		return res.end();
	}));

	adminRouter.put("/b/:board/:avatarId/:parameterId", requireBoard("board", boardManager), run(async function(req, res) {
		let parameter;
		try {
			parameter = req.board.constructParameter(
				req.params.avatarId,
				req.params.parameterId,
				req.body.parameter.name,
				req.body.parameter.dataType,
				req.body.parameter.controlType,
				req.body.parameter.setValue,
				req.body.parameter.defaultValue,
			);

			await req.board.updateParameter(req.params.avatarId, parameter);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		return res.json({ parameter: parameter.serialize() });
	}));

	app.use("/api/admin", adminRouter);

	const port = config.getRequiredKey("server", "port");
	const address = config.getRequiredKey("server", "address");

	await new Promise(resolve => httpServer.listen(port, address, resolve));

	console.log(`Server is listening on ${address}:${port}`);

	oscManager.init();
	avatarManager.init();
	socketManager.init();
}

main().catch(err => {
	console.log(err);
});