const fs = require("fs-extra");
const yaml = require("yaml");
const randomstring = require("randomstring");

const DEFAULT_CONFIG = {
	server: {
		address: "0.0.0.0",
		port: 8080,
		sessionSecret: randomstring.generate(32), // this will be stored on first server start and subsequently used
	},
	osc: {
		output: {
			address: "localhost",
			port: 9000,
		},
		listen: {
			address: "0.0.0.0",
			port: 9001,
		}
	},
	admin: {
		password: null,
	},
	boards: {}
};

class Config {
	constructor(config_file_path) {
		this._path = config_file_path;

		this._config = null;
	}

	async init() {
		if(fs.existsSync(this._path)) {
			const config_file_content = await fs.readFile(this._path, "utf8");
			this._config = yaml.parse(config_file_content);
		} else {
			this._config = DEFAULT_CONFIG;
			await fs.writeFileSync(this._path, yaml.stringify(this._config));
		}
	}

	async _storeConfig() {
		await fs.writeFileSync(this._path, yaml.stringify(this._config));
	}

	getKey(...path) {
		let cur = this._config;
		for (let p of path) {
			if (!(p in cur)) {
				return null;
			}
			cur = cur[p];
		}
		
		if (typeof cur === "object") {
			return Object.assign({}, cur);
		} else {
			return cur;
		}
	}

	existsKey(...path) {
		let cur = this._config;
		for (let p of path) {
			if (!(p in cur)) {
				return false;
			}
			cur = cur[p];
		}
		return true;
	}

	getRequiredKey(...path) {
		let cur = this._config;
		for (let p of path) {
			if (!(p in cur)) {
				throw new Error(`The required config key ${path.join(".")} is missing from the config`);
			}
			cur = cur[p];
		}

		if (typeof cur === "object" && cur !== null && !Array.isArray(yourVariable)) {
			return Object.assign({}, cur);
		} else if (typeof cur === "object" && cur !== null && Array.isArray(yourVariable)) {
			return [...cur]
		} else {
			return cur;
		}
	}

	async setKey(...params) {
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
	}
}

module.exports = { Config };