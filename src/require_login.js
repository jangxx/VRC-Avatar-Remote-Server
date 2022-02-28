function requireLogin(req, res, next) {
	if (!("target" in req.params)) {
		console.error("No target in req.params?");
		const err = new Error();
		err.statusCode = 400;
		return next(err);
	}

	const target = req.params.target;

	if (requireLoginInternal(target, req.session)) {
		return next();
	} else {
		const err = new Error();
		err.statusCode = 403;
		return next(err);
	}
}

function requireLoginSocketIO(req, next) {
	if (!("target" in req.query)) {
		const err = new Error("Target missing");
		err.statusCode = 400;
		return next(err);
	}

	const target = req.query.target;

	if (requireLoginInternal(target, req.session)) {
		return next();
	} else {
		const err = new Error();
		err.statusCode = 403;
		return next(err);
	}
}

function requireLoginInternal(target, session) {
	if (!("logins" in req.session)) {
		return false;
	}

	if (!(target in req.session.logins)) {
		return false;
	}

	if (!req.session.logins[target].loggedIn) {
		return false;
	}

	return true;
}

module.exports = { requireLogin, requireLoginSocketIO, requireLoginInternal };