import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION =
	typeof window !== "undefined" &&
	window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Animates a numeric value from 0 (or the previous value) to `target`.
 * SSR returns `target` immediately so static markup matches; the client
 * tween starts on mount via effect.
 */
export function useCountUp(target: number, durationMs = 900): number {
	const [value, setValue] = useState(target);
	const previous = useRef(target);

	useEffect(() => {
		if (REDUCED_MOTION || durationMs <= 0) {
			previous.current = target;
			setValue(target);
			return;
		}
		const start = previous.current;
		const startTime = performance.now();
		let raf = 0;
		const tick = (now: number) => {
			const t = Math.min(1, (now - startTime) / durationMs);
			const eased = 1 - (1 - t) ** 4;
			setValue(start + (target - start) * eased);
			if (t < 1) raf = requestAnimationFrame(tick);
			else previous.current = target;
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [target, durationMs]);

	return value;
}
