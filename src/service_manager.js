class ServiceManager {
	constructor() {
		this._services = {};
	}

	register(name, service) {
		if (name in this._services) throw new Error("This service is already registered");

		this._services[name] = service;
	}

	get(name) {
		if (!(name in this._services)) throw new Error("This service doesn't exist");

		return this._services[name];
	}

	getMultiple(names) {
		return names.map(name => this.get(name));
	}
}

module.exports = new ServiceManager();