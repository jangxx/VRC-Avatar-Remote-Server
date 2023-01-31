const express = require("express");
const fileUpload = require("express-fileupload");
const { z } = require("zod");
const { processRequest } = require("zod-express-middleware");

const { requireAdmin } = require("../require_login");
const ServiceManager = require("../service_manager");
const { requireBoard, unlockRequiredBoard } = require("../board_manager");

const adminRouter = express.Router({ mergeParams: true });
const [ boardManager, avatarManager, iconManager ] = ServiceManager.getMultiple(["boardManager", "avatarManager", "iconManager"]);

adminRouter.use(requireAdmin);

adminRouter.post("/upload-icon", fileUpload({
	limits: {
		files: 1
	}
}), async function(req, res) {
	if (!("icon" in req.files)) {
		return res.sendStatus(400);
	}

	const uploadedFile = req.files.icon;

	if (uploadedFile.mimetype !== "image/png") {
		return res.sendStatus(400);
	}

	const icon = await iconManager.uploadIcon(uploadedFile.data, uploadedFile.size);

	res.json({
		icon
	});
});

adminRouter.get("/icons", function(req, res) {
	res.json({
		icons: iconManager.getAllIcons().map(icon => {
			return { id: icon.id, size: icon.size };
		}),
	});
});

adminRouter.delete("/icon/:iconId", async function(req, res) {
	try {
		await iconManager.deleteIcon(req.params.iconId);
	} catch(err) {
		err.statusCode = 400;
		throw err;
	}

	await boardManager.removeAllMissingIcons();

	res.end();
});

adminRouter.get("/parameters", function(req, res) {
	return res.json({
		parameters: avatarManager.getAllRegisteredParams(),
	});
});

adminRouter.get("/boards", function(req, res) {
	return res.json({
		boards: Object.fromEntries(
			boardManager.getAllBoardIds().map(boardId => [
				boardId,
				boardManager.getBoard(boardId).serialize(true)
			])
		),
		defaultBoard: boardManager.getDefaultBoardId(),
	});
});

adminRouter.post("/create-board", async function(req, res) {
	let board;

	if (!req.query.duplicate) {
		board = await boardManager.createBoard();
	} else {
		board = await boardManager.duplicateBoard(req.query.duplicate);
	}

	return res.json({
		board: board.serialize(true),
	});
});

adminRouter.delete("/b/:board",
	requireBoard("board", boardManager, { locked: true }),
	async function(req, res, next) {
		await boardManager.deleteBoard(req.board.id);
		res.end();
		next();
	},
	unlockRequiredBoard(boardManager),
);

adminRouter.put("/b/:board/name",
	requireBoard("board", boardManager, { locked: true }),
	async function(req, res, next) {
		if (!("name" in req.body)) {
			res.sendStatus(400);
			return next();
		}

		try {
			await req.board.setName(req.body.name);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		res.end();
		return next();
	},
	unlockRequiredBoard(boardManager),
);

adminRouter.put("/b/:board/password",
	requireBoard("board", boardManager, { locked: true }),
	async function(req, res, next) {
		if (!("password" in req.body)) {
			res.sendStatus(400);
			return next();
		}

		try {
			await req.board.setPassword(req.body.password);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		res.end();
		return next();
	},
	unlockRequiredBoard(boardManager),
);

adminRouter.put("/b/:board/default",
	requireBoard("board", boardManager, { locked: true }),
	async function(req, res, next) {
		if (!("default" in req.body)) {
			res.sendStatus(400);
			return next();
		}

		const currentDefault = boardManager.getDefaultBoardId();

		try {
			if (req.body.default === true) {
				await boardManager.setDefaultBoardId(req.board.id);
			} else if  (req.body.default === false) {
				if (currentDefault === req.board.id) { // if this is currently the default unset the default
					await boardManager.setDefaultBoardId(null);
				} else {
					// otherwise we can't unset this board as the default
					err.statusCode = 400;
					throw err;
				}
			} else {
				// invalid value
				err.statusCode = 400;
				throw err;
			}
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		res.end();
		return next();
	},
	unlockRequiredBoard(boardManager),
);

adminRouter.post("/b/:board/add-avatar",
	requireBoard("board", boardManager),
	processRequest({
		body: z.object({
			avatar: z.object({
				id: z.string(),
				name: z.string(),
			})
		}),
	}),
	async function(req, res, next) {
		try {
			await req.board.addAvatar(req.body.avatar.id, req.body.avatar.name);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		res.end();
		return next();
	},
	unlockRequiredBoard(boardManager),
);

adminRouter.post("/b/:board/a/:avatarId/create-control", 
	requireBoard("board", boardManager, { locked: true }),
	processRequest({
		body: z.object({
			control: z.object({
				dataType: z.string(),
				controlType: z.string(),
				setValue: z.union([ z.boolean(), z.number(), z.null() ]),
				defaultValue: z.union([ z.boolean(), z.number(), z.null() ]),
				label: z.string(),
			}),
			parameter: z.object({
				inputAddress: z.string(),
				outputAddress: z.string(),
				name: z.string(),
			}),
		})
	}),
	async function(req, res, next) {
		let control;
		try {
			control = await req.board.createControl({
				avid: req.params.avatarId,
				dataType: req.body.control.dataType,
				controlType: req.body.control.controlType,
				setValue: req.body.control.setValue,
				defaultValue: req.body.control.defaultValue,
				label: req.body.control.label,
				parameter: req.body.parameter,
			});
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		res.json({
			control: control.serialize(),
		});
		return next();
	},
	unlockRequiredBoard(boardManager),
);

adminRouter.delete("/b/:board/a/:avatarId/p/:controlId",
	requireBoard("board", boardManager, { locked: true }),
	async function(req, res, next) {
		try {
			await req.board.removeControl(req.params.avatarId, req.params.controlId);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		res.end();
		return next();
	},
	unlockRequiredBoard(boardManager),
);

adminRouter.put("/b/:board/a/:avatarId/p/:controlId",
	requireBoard("board", boardManager, { locked: true }),
	processRequest({
		body: z.object({
			control: z.object({
				dataType: z.string(),
				controlType: z.string(),
				parameterName: z.string(),
				setValue: z.union([ z.boolean(), z.number(), z.null() ]),
				defaultValue: z.union([ z.boolean(), z.number(), z.null() ]),
				label: z.string(),
				icon: z.string().nullable(),
			}),
		}),
	}),
	async function(req, res, next) {
		let control;
		try {
			control = req.board.constructControl({
				avid: req.params.avatarId,
				id: req.params.controlId,
				parameterName: req.body.control.parameterName,
				dataType: req.body.control.dataType,
				controlType: req.body.control.controlType,
				setValue: req.body.control.setValue,
				defaultValue: req.body.control.defaultValue,
				label: req.body.control.label,
				icon: req.body.control.icon,
			});

			await req.board.updateControl(req.params.avatarId, control);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		res.json({ control: control.serialize() });
		return next();
	},
	unlockRequiredBoard(boardManager),
);

adminRouter.put("/b/:board/a/:avatarId/p/:controlId/group",
	requireBoard("board", boardManager, { locked: true }),
	processRequest({
		body: z.object({
			groupId: z.string(),
			position: z.number().int().nullable(),
		})
	}),
	async function(req, res, next) {
		try {
			await req.board.setControlGroup(req.params.avatarId, req.params.controlId, req.body.groupId, req.body.position);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		res.end();
		return next();
	},
	unlockRequiredBoard(boardManager),
);

adminRouter.post("/b/:board/a/:avatarId/create-group",
	requireBoard("board", boardManager, { locked: true }),
	processRequest({
		body: z.object({
			group: z.object({
				name: z.string(),
			}),
		})
	}),
	async function(req, res, next) {
		let groupId;
		try {
			groupId = await req.board.createGroup({
				avid: req.params.avatarId,
				name: req.body.group.name,
			});
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		res.json({ id: groupId });
		return next();
	},
	unlockRequiredBoard(boardManager),
);

adminRouter.delete("/b/:board/a/:avatarId/g/:groupId",
	requireBoard("board", boardManager, { locked: true }),
	async function(req, res, next) {
		try {
			await req.board.removeGroup(req.params.avatarId, req.params.groupId);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		res.end();
		return next();
	},
	unlockRequiredBoard(boardManager),
);

adminRouter.put("/b/:board/a/:avatarId/g/:groupId",
	requireBoard("board", boardManager, { locked: true }),
	processRequest({
		body: z.object({
			group: z.object({
				name: z.string(),
			}),
		})
	}),
	async function(req, res, next) {
		try {
			await req.board.updateGroup(req.params.avatarId, req.params.groupId, {
				name: req.body.group.name,
			});
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		res.end();
		return next();
	},
	unlockRequiredBoard(boardManager),
);

adminRouter.put("/b/:board/a/:avatarId/g/:groupId/control-order",
	requireBoard("board", boardManager, { locked: true }),
	processRequest({
		body: z.object({
			order: z.array(z.string()),
		})
	}),
	async function(req, res, next) {
		try {
			await req.board.setGroupControlOrder(req.params.avatarId, req.params.groupId, req.body.order);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		res.end();
		return next();
	},
	unlockRequiredBoard(boardManager),
);

adminRouter.put("/b/:board/a/:avatarId/group-order",
	processRequest({
		body: z.object({
			order: z.array(z.string()),
		})
	}),
	requireBoard("board", boardManager, { locked: true }),
	async function(req, res, next) {
		try {
			await req.board.setGroupOrder(req.params.avatarId, req.body.order);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		res.end();
		return next();
	},
	unlockRequiredBoard(boardManager),
);

adminRouter.post("/b/:board/a/:avatarId/duplicate-control",
	processRequest({
		body: z.object({
			controlId: z.string(),
		})
	}),
	requireBoard("board", boardManager, { locked: true }),
	async function(req, res, next) {
		try {
			await req.board.duplicateControl(req.params.avatarId, req.body.controlId);
		} catch(err) {
			err.statusCode = 400;
			throw err;
		}

		res.end();
		return next();
	},
	unlockRequiredBoard(boardManager),
)

module.exports = { adminRouter };