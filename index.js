const { createServer } = require("http");
const url = require("url");
const path = require("path");

const express = require("express");
const expressSession = require("express-session");
const MemoryStore = require("memorystore")(expressSession);
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const prompt = require("prompt");
prompt.message = "";
prompt.delimiter = "";

const { Config } = require("./src/config");
const ServiceManager = require("./src/service_manager");
const { OscManager } = require("./src/osc_manager");
const { VrcAvatarManager } = require("./src/vrc_avatar_manager");
const { BoardManager, unlockRequiredBoardOnError } = require("./src/board_manager");
const { SocketManager } = require("./src/socket_manager");
const { IconManager } = require("./src/icon_manager");
const { ApiKeyAuthentication } = require("./src/api_key_auth");
const { requireLoginSocketIO, requireLoginInternal } = require("./src/require_login");

if (process.argv.length < 3) {
	console.log("Usage: node index.js <config.yml> [icons_dir]");
	process.exit(0);
}

const config = new Config(process.argv[2]);
const oscManager = new OscManager(config);
const avatarManager = new VrcAvatarManager(oscManager, config);
const iconManager = new IconManager(config);
const boardManager = new BoardManager(config, avatarManager, iconManager);
const apiKeyAuth = new ApiKeyAuthentication(config);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const socketManager = new SocketManager(io, boardManager, avatarManager);

ServiceManager.register("avatarManager", avatarManager);
ServiceManager.register("boardManager", boardManager);
ServiceManager.register("iconManager", iconManager);

const { adminRouter } = require("./src/routes/admin");
const { boardRouter } = require("./src/routes/board");

async function main() {
	await config.init();
	await iconManager.init(process.argv[3]);

	try {
		boardManager.tryLoadingAllBoards();
	} catch(e) {
		console.log(`Validation of board has failed: ${e.message}`);
		process.exit(1);
	}

	if (config.getRequiredKey("firstTimeSetup")) {
		prompt.start({ noHandleSIGINT: true });
		
		console.log("Running first time setup");

		const result = await prompt.get({
			properties: {
				running_in_docker: {
					description: "Are you running in docker right now? [y/N]",
					pattern: /^y|n$/,
				},
			},
		});

		if (result.running_in_docker === 'y') {
			await config.setKey("osc", "output", "address", "host.docker.internal");
		}

		await config.setKey("firstTimeSetup", false);
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
				console.log("Admin password has been set successfully! You can now start the server again with the config file that was just created.");
				break;
			}
		}

		process.exit(0);
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

	app.post("/api/login/:target", async function(req, res) {
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
	});

	app.get("/api/login/:target", async function(req, res) {
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
	});

	app.use("/api/b/:board", boardRouter);
	app.use("/api/admin", adminRouter);

	app.use(unlockRequiredBoardOnError(boardManager));

	const port = config.getRequiredKey("server", "port");
	const address = config.getRequiredKey("server", "address");

	await new Promise(resolve => httpServer.listen(port, address, resolve));

	console.log(`Server is listening on ${address}:${port}`);

	oscManager.init();
	avatarManager.init();
	socketManager.init();
	apiKeyAuth.init();
}

main().catch(err => {
	console.log(err);
	process.exit(1);
});