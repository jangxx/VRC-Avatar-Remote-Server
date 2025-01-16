"use strict";
exports.__esModule = true;
exports.validateRequest = exports.validateRequestQuery = exports.validateRequestParams = exports.validateRequestBody = exports.processRequest = exports.processRequestQuery = exports.processRequestParams = exports.processRequestBody = exports.sendError = exports.sendErrors = exports.stripReadOnly = void 0;
function stripReadOnly(readOnlyItem) {
    return readOnlyItem;
}
exports.stripReadOnly = stripReadOnly;
var sendErrors = function (errors, res) {
    return res.status(400).send(errors.map(function (error) { return ({ type: error.type, errors: error.errors }); }));
};
exports.sendErrors = sendErrors;
var sendError = function (error, res) {
    return res.status(400).send({ type: error.type, errors: error.errors });
};
exports.sendError = sendError;
function processRequestBody(effectsSchema) {
    return function (req, res, next) {
        var parsed = effectsSchema.safeParse(req.body);
        if (parsed.success) {
            req.body = parsed.data;
            return next();
        }
        else {
            return exports.sendErrors([{ type: 'Body', errors: parsed.error }], res);
        }
    };
}
exports.processRequestBody = processRequestBody;
function processRequestParams(effectsSchema) {
    return function (req, res, next) {
        var parsed = effectsSchema.safeParse(req.params);
        if (parsed.success) {
            req.params = parsed.data;
            return next();
        }
        else {
            return exports.sendErrors([{ type: 'Params', errors: parsed.error }], res);
        }
    };
}
exports.processRequestParams = processRequestParams;
function processRequestQuery(effectsSchema) {
    return function (req, res, next) {
        var parsed = effectsSchema.safeParse(req.query);
        if (parsed.success) {
            req.query = parsed.data;
            return next();
        }
        else {
            return exports.sendErrors([{ type: 'Query', errors: parsed.error }], res);
        }
    };
}
exports.processRequestQuery = processRequestQuery;
function processRequest(schemas) {
    return function (req, res, next) {
        var errors = [];
        if (schemas.params) {
            var parsed = schemas.params.safeParse(req.params);
            if (parsed.success) {
                req.params = parsed.data;
            }
            else {
                errors.push({ type: 'Params', errors: parsed.error });
            }
        }
        if (schemas.query) {
            var parsed = schemas.query.safeParse(req.query);
            if (parsed.success) {
                req.query = parsed.data;
            }
            else {
                errors.push({ type: 'Query', errors: parsed.error });
            }
        }
        if (schemas.body) {
            var parsed = schemas.body.safeParse(req.body);
            if (parsed.success) {
                req.body = parsed.data;
            }
            else {
                errors.push({ type: 'Body', errors: parsed.error });
            }
        }
        if (errors.length > 0) {
            return exports.sendErrors(errors, res);
        }
        return next();
    };
}
exports.processRequest = processRequest;
var validateRequestBody = function (schema) { return function (req, res, next) {
    var parsed = schema.safeParse(req.body);
    if (parsed.success) {
        return next();
    }
    else {
        return exports.sendErrors([{ type: 'Body', errors: parsed.error }], res);
    }
}; };
exports.validateRequestBody = validateRequestBody;
var validateRequestParams = function (schema) { return function (req, res, next) {
    var parsed = schema.safeParse(req.params);
    if (parsed.success) {
        return next();
    }
    else {
        return exports.sendErrors([{ type: 'Params', errors: parsed.error }], res);
    }
}; };
exports.validateRequestParams = validateRequestParams;
var validateRequestQuery = function (schema) { return function (req, res, next) {
    var parsed = schema.safeParse(req.query);
    if (parsed.success) {
        return next();
    }
    else {
        return exports.sendErrors([{ type: 'Query', errors: parsed.error }], res);
    }
}; };
exports.validateRequestQuery = validateRequestQuery;
var validateRequest = function (_a) {
    var params = _a.params, query = _a.query, body = _a.body;
    return function (req, res, next) {
        var errors = [];
        if (params) {
            var parsed = params.safeParse(req.params);
            if (!parsed.success) {
                errors.push({ type: 'Params', errors: parsed.error });
            }
        }
        if (query) {
            var parsed = query.safeParse(req.query);
            if (!parsed.success) {
                errors.push({ type: 'Query', errors: parsed.error });
            }
        }
        if (body) {
            var parsed = body.safeParse(req.body);
            if (!parsed.success) {
                errors.push({ type: 'Body', errors: parsed.error });
            }
        }
        if (errors.length > 0) {
            return exports.sendErrors(errors, res);
        }
        return next();
    };
};
exports.validateRequest = validateRequest;
