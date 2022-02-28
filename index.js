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
const { requireLogin, requireLoginSocketIO, requireLoginInternal } = require("./src/require_login");
const run = require("./src/express_async_middleware");

if (process.argv.length < 3) {
	console.log("Usage: node index.js <config.yml>");
	process.exit(0);
}

const config = new Config(process.argv[2]);
const oscManager = new OscManager(config);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

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

	app.post("/api/login/:target", run(async function(req, res) {
		if (!("password" in req.body)) {
			return res.sendStatus(400);
		}

		let checkHash;
		if (req.params.target != "admin") {
			if (!config.existsKey("boards", req.params.target)) {
				return res.sendStatus(404);
			}

			checkHash = config.getKey("boards", req.params.target, "password");

			if (checkHash == null) {
				return res.sendStatus(400); // there is no password set up for this board
			}
		} else {
			checkHash = config.getKey("admin", "password");
		}

		const check_result = bcrypt.compare(req.body.password, checkHash);

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
		if (!config.existsKey("boards", req.params.target)) {
			return res.sendStatus(404);
		}

		const checkHash = config.getKey("boards", req.params.target, "password");

		if (!("logins" in req.session)) {
			req.session.logins = {};
		}

		if (checkHash === null) { // no password required for this board, just set a login cookie
			req.session.logins[req.params.target] = {
				loggedIn: true,
			};
			req.session.save();
			return res.json({ loggedIn: true });
		} else {
			return res.json({ loggedIn: requireLoginInternal(req.params.target, req.session) });
		}
	}));

	const port = config.getRequiredKey("server", "port");
	const address = config.getRequiredKey("server", "address");

	await new Promise(resolve => httpServer.listen(port, address, resolve));

	console.log(`Server is listening on ${address}:${port}`);

	oscManager.init();
}

main().catch(err => {
	console.log(err);
});