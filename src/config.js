const fs = require("fs-extra");
const yaml = require("yaml");
const randomstring = require("randomstring");

const { AsyncLock } = require("./async_lock");

const DEFAULT_CONFIG = {
	server: {
		address: "0.0.0.0",
		port: 8080,
		sessionSecret: randomstring.generate(32), // this will be stored on first server start and subsequently used
		api_keys: [],
	},
	osc: {
		log_all_outputs: false,
		log_all_inputs: false,
		log_errors: false,
		output: {
			address: "localhost",
			port: 9000,
		},
		listen: {
			address: "0.0.0.0",
			port: 9001,
		}
	},
	icons: {
		path: "./icons",
	},
	admin: {
		password: null,
	},
	defaultBoard: null,
	firstTimeSetup: true,
	boards: {},
	avatars: {},
};

class KeyNotFoundError extends Error {
	constructor(message) {
		super(message);
	}
}

class Config {
	constructor(config_file_path) {
		this._path = config_file_path;

		this._lock = new AsyncLock();
		this._config = null;
	}

	async init() {
		if(fs.existsSync(this._path)) {
			const config_file_content = await fs.readFile(this._path, "utf8");
			this._config = yaml.parse(config_file_content);
		} else {
			this._config = DEFAULT_CONFIG;
			await fs.writeFile(this._path, yaml.stringify(this._config));
		}
	}

	async _storeConfig() {
		await fs.writeFile(this._path, yaml.stringify(this._config));
	}

	_getKey(path) {
		if (this._config === null) throw new Error("Config is not initialized yet");

		let cur = this._config;
		for (let p of path) {
			if (!(p in cur)) {
				throw new KeyNotFoundError();
			}
			cur = cur[p];
		}

		if (typeof cur === "object" && cur !== null && !Array.isArray(cur)) {
			return Object.assign({}, cur);
		} else if (typeof cur === "object" && cur !== null && Array.isArray(cur)) {
			return [...cur];
		} else {
			return cur;
		}
	}

	getKey(...path) {
		try {
			const result = this._getKey(path);
			return result;
		} catch(err) {
			if (err instanceof KeyNotFoundError) {
				return null;
			} else {
				throw err;
			}
		}
	}

	getKeyWithDefault(...params) {
		try {
			const result = this._getKey(params.slice(0, -1));
			return result;
		} catch(err) {
			if (err instanceof KeyNotFoundError) {
				return params[params.length - 1];
			} else {
				throw err;
			}
		}
	}

	getRequiredKey(...path) {
		try {
			const result = this._getKey(path);
			return result;
		} catch(err) {
			if (err instanceof KeyNotFoundError) {
				throw new Error(`The required config key ${path.join(".")} is missing from the config`);
			} else {
				throw err;
			}
		}
	}

	existsKey(...path) {
		if (this._config === null) throw new Error("Config is not initialized yet");

		let cur = this._config;
		for (let p of path) {
			if (!(p in cur)) {
				return false;
			}
			cur = cur[p];
		}
		return true;
	}

	async setKey(...params) {
		if (this._config === null) throw new Error("Config is not initialized yet");

		await this._lock.acquire();

		const path = params.slice(0, -1);
		const value = params[params.length - 1];

		let cur = this._config;
		for (let i = 0; i < path.length - 1; i++) {
			if (!(path[i] in cur)) {
				cur[path[i]] = {};
			}

			cur = cur[path[i]];
		}
		cur[path[path.length - 1]] = value;

		await this._storeConfig();
		this._lock.release();
	}

	async unsetKey(...path) {
		if (this._config === null) throw new Error("Config is not initialized yet");

		await this._lock.acquire();

		let cur = this._config;
		for (let i = 0; i < path.length - 1; i++) {
			if (!(path[i] in cur)) {
				cur[path[i]] = {};
			}

			cur = cur[path[i]];
		}
		
		delete cur[path[path.length - 1]];

		await this._storeConfig();
		this._lock.release();
	}
}

module.exports = { Config };