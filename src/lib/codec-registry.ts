import type { Codec } from "numcodecs";

type Config = Record<string, any>;
type CodecImporter = () => Promise<{ fromConfig: (config: Config) => Codec }>;

export const registry: Map<string, CodecImporter> = new Map();
