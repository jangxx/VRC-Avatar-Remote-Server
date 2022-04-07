const { createServer } = require("http");
const url = require("url");
const path = require("path");

const express = require("express");
const expressSession = require("express-session");
const MemoryStore = require("memorystore")(expressSession);
const fileUpload = require("express-fileupload");
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
const { IconManager } = require("./src/icon_manager");
const { ApiKeyAuthentication } = require("./src/api_key_auth");
const { requireLogin, requireLoginSocketIO, requireLoginInternal, requireAdmin } = require("./src/require_login");
const run = require("./src/express_async_middleware");

if (process.argv.length < 3) {
	console.log("Usage: node index.js <config.yml>");
	process.exit(0);
}

const config = new Config(process.argv[2]);
const oscManager = new OscManager(config);
const avatarManager = new VrcAvatarManager(oscManager);
const iconManager = new IconManager(config);
const boardManager = new BoardManager(config, iconManager);
const apiKeyAuth = new ApiKeyAuthentication(config);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const socketManager = new SocketManager(io, boardManager, avatarManager);

async function main() {
	await config.init();
	await iconManager.init();

	try {
		boardManager.tryLoadingAllBoards();
	} catch(e) {
		console.log(`Validation of board has failed: ${e.message}`);
		process.exit(1);
	}

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
				console.log("The passwords do not match! Please retry.");
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
	app.use(function(req, res, next) {
		if (req.get("x-api-key") !== undefined) {
			return next(); // skip session creation if an api key was provided
		}
		sessionMiddleware(req, res, next);
	});
	app.use(function(req, res, next) {
		apiKeyAuth.expressMiddleware(req, res, next);
	});
	app.use(express.json());
	app.use("/build", express.static(path.join(__dirname, "client/dist")));

	app.get("/", function(req, res) {
		res.sendFile(path.join(__dirname, "client/dist/index.html"));
	});

	app.get("/b/:boardId", function(req, res) {
		res.sendFile(path.join(__dirname, "client/dist/index.html"));
	});

	app.get("/admin", function(req, res) {
		res.sendFile(path.join(__dirname, "client/dist/admin.html"));
	});

	app.get("/i/:iconId", function(req, res) {
		let iconPath;
		try {
			iconPath = iconManager.getIconPath(req.params.iconId);
		} catch(_) {
			return res.sendStatus(404);
		}

		res.sendFile(iconPath);
	});

	io.use((socket, next) => {
		const u = url.parse(socket.request.url, true);
		socket.request.query = u.query;

		next();
	});

	io.use((socket, next) => {
		if ("x-api-key" in socket.request.headers) {
			apiKeyAuth.socketioMiddleware(socket, next);
		} else {
			sessionMiddleware(socket.request, {}, next);
		}
	});

	// check login or validate api key
	// also checks if query.target is set
	io.use((socket, next) => {
		requireLoginSocketIO(socket.request, next);
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
			return res.json({ loggedIn: requireLoginInternal(req.params.target, req) });
		}
	}));

	/**
	 * Board router
	 */

	const boardRouter = express.Router({ mergeParams: true });

	boardRouter.use(requireLogin("board"), requireBoard("board", boardManager));

	boardRouter.get("/full", function(req, res) {
		return res.json({
			board: req.board.serialize(true),
		});
	});

	boardRouter.get("/avatars", function(req, res) {
		return res.json({
			avatars: req.board.serialize().avatars,
		});
	});

	boardRouter.get("/current-avatar", function(req, res) {
		const currentAvatar = avatarManager.getCurrentAvatarId();

		if (currentAvatar === null) {
			return res.json({ id: null });
		}

		if (req.board.hasAvatar(currentAvatar)) {
			return res.json({
				id: currentAvatar,
				controls: avatarManager.getCurrentParams(),
			});
		} else {
			return res.json({ id: null });
		}
	});

	app.use("/api/b/:board", boardRouter);

	/**
	 * Admin router
	 */

	const adminRouter = express.Router({ mergeParams: true });

	adminRouter.use(requireAdmin);

	adminRouter.post("/upload-icon", fileUpload({
		limits: {
			files: 1
		}
	}), run(async function(req, res) {
		if (!("icon" in req.files)) {
			return res.sendStatus(400);
		}

		const uploadedFile = req.files.icon;

		if (uploadedFile.mimetype !== "image/png") {
			return res.sendStatus(400);
		}

		const icon = await iconManager.uploadIcon(uploadedFile.data, uploadedFile.size);

		res.json({
			icon
		});
	}));

	adminRouter.get("/icons", function(req, res) {
		res.json({
			icons: iconManager.getAllIcons().map(icon => {
				return { id: icon.id, size: icon.size };
			}),
		});
	});

	adminRouter.delete("/icon/:iconId", run(async function(req, res) {
		try {
			await iconManager.deleteIcon(req.params.iconId);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		await boardManager.removeAllMissingIcons();

		res.end();
	}));

	adminRouter.get("/boards", function(req, res) {
		return res.json({
			boards: Object.fromEntries(
				boardManager.getAllBoardIds().map(boardId => [
					boardId,
					boardManager.getBoard(boardId).serialize(true)
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

	adminRouter.delete("/b/:board", requireBoard("board", boardManager), run(async function(req, res) {
		await boardManager.deleteBoard(req.board.id);
		res.end();
	}));

	adminRouter.put("/b/:board/name", requireBoard("board", boardManager), run(async function(req, res) {
		if (!("name" in req.body)) {
			return res.sendStatus(400);
		}

		try {
			await req.board.setName(req.body.name);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		return res.end();
	}));

	adminRouter.put("/b/:board/password", requireBoard("board", boardManager), run(async function(req, res) {
		if (!("password" in req.body)) {
			return res.sendStatus(400);
		}

		try {
			await req.board.setPassword(req.body.password);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		return res.end();
	}));

	adminRouter.post("/b/:board/add-avatar", requireBoard("board", boardManager), run(async function(req, res) {
		if (!("avatar" in req.body)) {
			return res.sendStatus(400);
		}

		if (!("id" in req.body.avatar && "name" in req.body.avatar)) {
			return res.sendStatus(400);
		}

		try {
			await req.board.addAvatar(req.body.avatar.id, req.body.avatar.name);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		return res.end();
	}));

	adminRouter.post("/b/:board/a/:avatarId/create-control", requireBoard("board", boardManager), run(async function(req, res) {
		if (!("control" in req.body)) {
			return res.sendStatus(400);
		}

		if (!("name" in req.body.control)) {
			return res.sendStatus(400);
		}

		let control;
		try {
			control = await req.board.createControl(
				req.params.avatarId,
				req.body.control.name,
				req.body.control.dataType,
				req.body.control.controlType,
				req.body.control.setValue,
				req.body.control.defaultValue,
				req.body.control.label
			);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		return res.json({
			control: control.serialize(),
		});
	}));

	adminRouter.delete("/b/:board/a/:avatarId/p/:controlId", requireBoard("board", boardManager), run(async function(req, res) {
		try {
			await req.board.removeControl(req.params.avatarId, req.params.controlId);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		return res.end();
	}));

	adminRouter.put("/b/:board/a/:avatarId/p/:controlId", requireBoard("board", boardManager), run(async function(req, res) {
		let control;
		try {
			control = req.board.constructControl(
				req.params.avatarId,
				req.params.controlId,
				req.body.control.name,
				req.body.control.dataType,
				req.body.control.controlType,
				req.body.control.setValue,
				req.body.control.defaultValue,
				req.body.control.label,
				req.body.control.icon,
			);

			await req.board.updateControl(req.params.avatarId, control);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		return res.json({ control: control.serialize() });
	}));

	app.use("/api/admin", adminRouter);

	const port = config.getRequiredKey("server", "port");
	const address = config.getRequiredKey("server", "address");

	await new Promise(resolve => httpServer.listen(port, address, resolve));

	console.log(`Server is listening on ${address}:${port}`);

	oscManager.init();
	avatarManager.init();
	socketManager.init();
	apiKeyAuth.init();

	if ("TEST_TRIGGER" in process.env) {
		setTimeout(() => {
			oscManager.emit("message", {
				address: "/avatar/change", 
				value: "avtr_418bf257-d957-46c9-be51-bf97ac25b862",
			});
		}, 1000);
	}
}

main().catch(err => {
	console.log(err);
	process.exit(1);
});