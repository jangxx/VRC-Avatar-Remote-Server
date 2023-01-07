const express = require("express");

const { requireLogin } = require("../require_login");
const ServiceManager = require("../service_manager");
const { requireBoard } = require("../board_manager");

const boardRouter = express.Router({ mergeParams: true });
const [ boardManager, avatarManager ] = ServiceManager.getMultiple(["boardManager", "avatarManager"]);

boardRouter.use(requireLogin("board"), requireBoard("board", boardManager));

boardRouter.get("/full", function(req, res) {
	return res.json({
		board: req.board.serialize(true, true),
	});
});

boardRouter.get("/avatars", function(req, res) {
	return res.json({
		avatars: req.board.serialize(true, true).avatars,
	});
});

boardRouter.get("/current-avatar", function(req, res) {
	const currentAvatar = avatarManager.getCurrentAvatarId();

	if (currentAvatar === null) {
		return res.json({ id: null });
	}

	if (req.board.hasAvatar(currentAvatar)) {
		return res.json({
			id: currentAvatar,
			controls: avatarManager.getCurrentParams(),
		});
	} else {
		return res.json({ id: null });
	}
});

module.exports = { boardRouter };