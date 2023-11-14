class ManualPromise {
	constructor() {
		this._resolve = null;
		this._reject = null;

		this._promise = new Promise((resolve, reject) => {
			this._resolve = resolve;
			this._reject = reject;
		});
	}

	get promise() {
		return this._promise;
	}

	resolve() {
		this._resolve();
	}
}

class AsyncLock {
	constructor() {
		this._queue = [];
	}

	async acquire() {
		const lockPromise = new ManualPromise();

		this._queue.push(lockPromise);

		if (this._queue.length == 1) {
			return;
		} else {
			await this._queue[this._queue.length - 2].promise;
		}
	}

	release() {
		const promise = this._queue.shift();

		setTimeout(() => promise.resolve(), 0); // run the code that's waiting for the lock after we are finished with the current "thread"
	}
}

module.exports = { AsyncLock };