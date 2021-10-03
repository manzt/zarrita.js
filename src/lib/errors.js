// @ts-check
export class NotImplementedError extends Error {
  __zarr__ = 'NotImplementedError';
  /** @param {string} msg */
  constructor(msg) {
    super(msg);
    this.name = 'NotImplementedError';
  }
}

export class NodeNotFoundError extends Error {
  __zarr__ = 'NodeNotFoundError';
  /** @param {string} msg */
  constructor(msg) {
    super(msg);
    this.name = 'NodeNotFoundError';
  }
}

export class IndexError extends Error {
  __zarr__ = 'IndexError';
  /** @param {string} msg */
  constructor(msg) {
    super(msg);
    this.name = 'IndexError';
  }
}

export class KeyError extends Error {
  __zarr__ = 'KeyError';
  /** @param {string} msg */
  constructor(msg) {
    super(msg);
    this.name = 'KeyError';
  }
}

export class AssertionError extends Error {
  __zarr__ = 'AssertionError';
  /** @param {string} msg */
  constructor(msg) {
    super(msg);
    this.name = 'ZarrAssertionError';
  }
}

/**
 * @param {boolean} condition
 * @param {string} msg
 */
export function assert(condition, msg = 'Assertion failed') {
  if (!condition) {
    throw new AssertionError(msg);
  }
}
