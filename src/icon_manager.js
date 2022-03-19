const path = require("path");

const fs = require("fs-extra");
const glob = require("glob");
const { v4: uuiv4 } = require("uuid");

const { Config } = require("./config");

function globAsync(pattern, options) {
	return new Promise((resolve, reject) => {
		glob(pattern, options, (err, matches) => {
			if (err) {
				return reject(err);
			} else {
				return resolve(matches);
			}
		});
	});
};

class IconManager {
	/**
	 * 
	 * @param {Config} config 
	 */
	 constructor(config) {
		this._config = config;

		this._base_path = null;
		this._icons = {};
	}

	async init() {
		this._base_path = this._config.getRequiredKey("icons", "path");

		if (!fs.pathExistsSync(this._base_path)) {
			await fs.mkdirp(this._base_path);
		}

		const images = await globAsync(path.join(this._base_path, "*.png"));

		for (let imagePath of images) {
			const matches = imagePath.match(/.*?\/(.*?)\.png/);

			if (matches === null) {
				throw new Error(`Icon ${imagePath} has an invalid filename`);
			}

			const imageId = matches[1];
			
			const iconDef = {
				path: imagePath,
				id: imageId,
				size: (await fs.stat(imagePath)).size,
			};

			this._icons[imageId] = iconDef;
		}
	}

	getAllIcons() {
		return Object.values(this._icons);
	}

	iconExists(id) {
		return id in this._icons;
	}

	getIconPath(id) {
		if (!(id in this._icons)) {
			throw new Error("This icon does not exist");
		}

		return path.resolve(process.cwd(), this._icons[id].path);
	}

	async uploadIcon(data, size) {
		const id = `icon_${uuiv4()}`;

		const imagePath = path.join(this._base_path, `${id}.png`);

		await fs.writeFile(imagePath, data);

		const iconDef = {
			path: imagePath,
			id,
			size,
		}

		this._icons[id] = iconDef;

		return iconDef;
	}

	async deleteIcon(id) {
		if (!(id in this._icons)) {
			throw new Error("This icon does not exist");
		}

		const iconDef = this._icons[id];

		await fs.unlink(iconDef.path);

		delete this._icons[id];
	}
};

module.exports = { IconManager };