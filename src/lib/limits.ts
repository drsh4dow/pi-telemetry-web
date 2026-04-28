export const telemetryEventMaxBodyBytes = 256 * 1024;
export const telemetryImportMaxBodyBytes = 5 * 1024 * 1024;

export function isOverUtf8ByteLimit(text: string, maxBytes: number): boolean {
	return Buffer.byteLength(text, "utf8") > maxBytes;
}
