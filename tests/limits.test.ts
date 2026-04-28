import { describe, expect, test } from "bun:test";
import { isOverUtf8ByteLimit } from "../src/lib/limits";

describe("byte limits", () => {
	test("counts UTF-8 bytes instead of JavaScript characters", () => {
		const text = "😀".repeat(4);

		expect(text.length).toBe(8);
		expect(isOverUtf8ByteLimit(text, 15)).toBe(true);
		expect(isOverUtf8ByteLimit(text, 16)).toBe(false);
	});
});
