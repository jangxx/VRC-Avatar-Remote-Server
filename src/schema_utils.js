

class RequiredObjectSchemaBuilder {
	constructor() {
		this._properties = {};
	}

	prop(name, typedef) {
		this._properties[name] = typedef;
		return this;
	}

	build() {
		return {
			type: "object",
			properties: this._properties,
			required: Object.keys(this._properties),
		}
	}
}

function Obj() {
	return new RequiredObjectSchemaBuilder();
}

module.exports = {
	Obj,
};