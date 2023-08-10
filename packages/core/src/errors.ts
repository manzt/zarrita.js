export class NodeNotFoundError extends Error {
	constructor(msg: string) {
		super(msg);
		this.name = "NodeNotFoundError";
	}
}

export class KeyError extends Error {
	constructor(msg: string) {
		super(msg);
		this.name = "KeyError";
	}
}
