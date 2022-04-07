const { Config } = require("./config");

class ApiKeyAuthentication {
    /**
     * @param {Config} config
     */
    constructor(config) {
        this._config = config;

        this._api_keys = new Set();
    }

    init() {
        this._api_keys = new Set(this._config.getKeyWithDefault("server", "api_keys", []));
    }

    _checkApikey(req, apiKey) {
        if (this._api_keys.has(apiKey)) {
            req.apiKeyAuthenticated = true;
        } else {
            req.apiKeyAuthenticated = false;
        }
    }

    expressMiddleware(req, res, next) {
        if (req.get("x-api-key") === undefined) {
            return next();
        }

        const apiKey = req.get("x-api-key");
        this._checkApikey(req, apiKey);
        next();
    }

    socketioMiddleware(socket, next) {
        if (!("x-api-key" in socket.request.headers)) {
            return next();
        }

        const apiKey = socket.request.headers["x-api-key"];
        this._checkApikey(socket.request, apiKey);
        next();
    }
}

module.exports = { ApiKeyAuthentication };