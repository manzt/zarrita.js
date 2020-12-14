export class NotImplementedError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'NotImplementedError';
  }
}
export class NodeNotFoundError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'NodeNotFoundError';
  }
}
export class IndexError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'IndexError';
  }
}
export class KeyError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'KeyError';
  }
}

export class ZarrAssertionError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ZarrAssertionError';
  }
}

export function assert(condition: boolean, msg = 'Assertion failed') {
  if (!condition) {
    throw new ZarrAssertionError(msg);
  }
}
