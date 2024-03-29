function requireLogin(paramName) {
	return function(req, res, next) {
		if (!(paramName in req.params)) {
			console.error(`${paramName} missing from req.params?`);
			const err = new Error();
			err.statusCode = 500;
			return next(err);
		}

		const target = req.params[paramName];

		if (requireLoginInternal(target, req)) {
			return next();
		} else {
			// const err = new Error();
			// err.statusCode = 403;
			// return next(err);
			res.sendStatus(403);
			return;
		}
	};
}

function requireLoginSocketIO(req, next) {
	if (!("target" in req.query)) {
		const err = new Error("Target missing");
		err.statusCode = 400;
		return next(err);
	}

	const target = req.query.target;

	if (requireLoginInternal(target, req)) {
		return next();
	} else {
		const err = new Error();
		err.statusCode = 403;
		return next(err);
	}
}

function requireLoginInternal(target, req) {
	if (req.apiKeyAuthenticated) {
		return true;
	}

	if (!("session" in req)) {
		return false;
	}

	const session = req.session;

	if (!("logins" in session)) {
		return false;
	}

	if ("admin" in session.logins) {
		if (session.logins.admin.loggedIn) {
			return true;
		}
	}

	if (!(target in session.logins)) {
		return false;
	}

	if (!session.logins[target].loggedIn) {
		return false;
	}

	return true;
}

function requireAdmin(req, res, next) {
	if (requireLoginInternal("admin", req)) {
		return next();
	} else {
		return res.sendStatus(403);
	}
}

module.exports = { requireLogin, requireLoginSocketIO, requireLoginInternal, requireAdmin };