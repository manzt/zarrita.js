// @ts-check

/** @typedef {import('numcodecs').Codec} Codec */
/** @typedef {<Config extends Record<string, any>=Record<string, any>>(config: Config) => Codec} FromConfig */
/** @typedef {() => Promise<{ fromConfig: FromConfig }> | { fromConfig: FromConfig }} CodecImporter */

/** @type {Map<string, CodecImporter>} */
export const registry = new Map();
