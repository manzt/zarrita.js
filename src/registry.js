// @ts-check

/** @typedef {import('./types').Codec} Codec */
/** @typedef {<Config extends Record<string, any>=Record<string, any>>(config: Config) => Codec} FromConfig */
/** @typedef {() => import('./types').Promisable<{ fromConfig: FromConfig }>} CodecImporter */

/** @type {Map<string, CodecImporter>} */
export const registry = new Map();
