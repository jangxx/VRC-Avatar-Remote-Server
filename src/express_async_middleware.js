function run_async(fn) {
	return function(req, res, next) {
		fn(req, res, next).catch(next);
	}
}

module.exports = run_async;