interface ZarrError {
  __zarr__: string;
}

function isZarrError(o: unknown): o is ZarrError {
  return typeof o === 'object' && o !== null && '__zarr__' in o;
}

export const isKeyError = (o: unknown) => isZarrError(o) && o.__zarr__ == 'KeyError';

export class NotImplementedError extends Error implements ZarrError {
  __zarr__ = 'NotImplementedError';
  constructor(msg: string) {
    super(msg);
    this.name = 'NotImplementedError';
  }
}

export class NodeNotFoundError extends Error implements ZarrError {
  __zarr__ = 'NodeNotFoundError';
  constructor(msg: string) {
    super(msg);
    this.name = 'NodeNotFoundError';
  }
}

export class IndexError extends Error implements ZarrError {
  __zarr__ = 'IndexError';
  constructor(msg: string) {
    super(msg);
    this.name = 'IndexError';
  }
}

export class KeyError extends Error implements ZarrError {
  __zarr__ = 'KeyError';
  constructor(msg: string) {
    super(msg);
    this.name = 'KeyError';
  }
}

export class AssertionError extends Error implements ZarrError {
  __zarr__ = 'AssertionError';
  constructor(msg: string) {
    super(msg);
    this.name = 'ZarrAssertionError';
  }
}

export function assert(condition: boolean, msg = 'Assertion failed') {
  if (!condition) {
    throw new AssertionError(msg);
  }
}
