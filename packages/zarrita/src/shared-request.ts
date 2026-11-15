/**
 * One in-flight request shared by several callers, each with its own signal.
 *
 * A caller that aborts rejects right away with its own reason, but the
 * request itself is only cancelled once every caller has aborted.
 */
export class SharedRequest<T> {
	#controller = new AbortController();
	#promise: Promise<T>;
	#waiting = 0;
	#settled = false;

	constructor(run: (signal: AbortSignal) => Promise<T>) {
		this.#promise = run(this.#controller.signal).finally(() => {
			this.#settled = true;
		});
		// Callers observe failures through `join`. Nobody may be left to.
		this.#promise.catch(() => {});
	}

	/** Whether every caller left and the request was cancelled. */
	get abandoned(): boolean {
		return this.#controller.signal.aborted;
	}

	join(signal?: AbortSignal): Promise<T> {
		this.#waiting++;
		if (!signal) {
			// A caller without a signal can never leave.
			return this.#promise;
		}
		if (signal.aborted) {
			this.#leave(signal.reason);
			return Promise.reject(signal.reason);
		}
		return new Promise<T>((resolve, reject) => {
			let onAbort = () => {
				this.#leave(signal.reason);
				reject(signal.reason);
			};
			signal.addEventListener("abort", onAbort, { once: true });
			this.#promise
				.then(resolve, reject)
				.finally(() => signal.removeEventListener("abort", onAbort));
		});
	}

	#leave(reason: unknown): void {
		this.#waiting--;
		if (this.#waiting === 0 && !this.#settled) {
			this.#controller.abort(reason);
		}
	}
}
