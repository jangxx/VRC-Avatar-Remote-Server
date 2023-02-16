// utilities which don't depend on native node modules

function isBlankString(str) {
	return !str || str === "" || typeof str !== 'string';
}

module.exports = {
	isBlankString,
};