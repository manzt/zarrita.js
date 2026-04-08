export class NodeNotFoundError extends Error {
	constructor(context: string, options: { cause?: Error } = {}) {
		super(`Node not found: ${context}`, options);
		this.name = "NodeNotFoundError";
	}
}

export class JsonDecodeError extends Error {
	constructor(cause: unknown) {
		super("Failed to decode JSON", { cause });
		this.name = "JsonDecodeError";
	}
}

export class KeyError extends Error {
	constructor(path: string) {
		super(`Missing key: ${path}`);
		this.name = "KeyError";
	}
}
