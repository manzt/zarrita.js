export class NodeNotFoundError extends Error {
	/** @param {string} msg */
	constructor(msg) {
		super(msg);
		this.name = "NodeNotFoundError";
	}
}

export class KeyError extends Error {
	/** @param {string} msg */
	constructor(msg) {
		super(msg);
		this.name = "KeyError";
	}
}
