/**
 * Stored values for a set amount of time and provides retrieval methods to access all currently stores values
 */
class TimedBuffer {
	constructor() {
		this._slots = {};
	}

	getAll() {
		// return shallow copy
		return Object.values(this._slots).map(slot => slot.value);
	}

	add(key, value, timeout) {
		if (key in this._slots) {
			clearTimeout(this._slots[key].timeout);
		} else {
			this._slots[key] = {};	
		}

		this._slots[key].value = value;
		this._slots[key].timeout = setTimeout(() => {
			delete this._slots[key];
		}, timeout);
	}
};

module.exports = { TimedBuffer };