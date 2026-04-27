import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	migrateDatabase,
	openTelemetryDatabase,
	type TelemetryDatabase,
} from "../src/lib/database";
import {
	authorizedBearer,
	ensureStoredIngestToken,
	importJsonl,
	ingestTurnUsage,
	rotateStoredIngestToken,
	telemetryHash,
	turnUsageRecordSchema,
} from "../src/lib/telemetry";

const tempDirs: string[] = [];
const databases: TelemetryDatabase[] = [];

afterEach(async () => {
	for (const database of databases.splice(0)) database.client.close();
	for (const dir of tempDirs.splice(0))
		await rm(dir, { recursive: true, force: true });
});

async function testDb() {
	const dir = await mkdtemp(join(tmpdir(), "pi-telemetry-web-test-"));
	tempDirs.push(dir);
	const database = openTelemetryDatabase(join(dir, "test.sqlite"));
	databases.push(database);
	migrateDatabase(database.client);
	return database;
}

function record(overrides: Record<string, unknown> = {}) {
	return {
		schemaVersion: 1,
		type: "turn_usage",
		timestamp: "2026-01-02T03:04:05.000Z",
		turn: { index: 7 },
		session: {
			id: "session-1",
			file: "/tmp/session.jsonl",
			cwd: "/work/acme/widget",
			cwdName: "widget",
		},
		model: {
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-sonnet-4-5",
		},
		labels: {
			team: "platform",
			project: "widget",
			developer: "dev@example.com",
		},
		git: {
			root: "/work/acme/widget",
			remote: "git@example.com:acme/widget.git",
			branch: "main",
			commit: "abc123",
			userName: "Dev",
			userEmail: "dev@example.com",
		},
		usage: {
			input: 100,
			output: 25,
			cacheRead: 10,
			cacheWrite: 5,
			totalTokens: 140,
			cost: {
				input: 0.001,
				output: 0.002,
				cacheRead: 0.0001,
				cacheWrite: 0.0002,
				total: 0.0033,
			},
		},
		...overrides,
	};
}

describe("telemetry ingestion", () => {
	test("validates current pi-telemetry-minimal turn_usage records", () => {
		const parsed = turnUsageRecordSchema.parse(record());
		expect(parsed.schemaVersion).toBe(1);
		expect(parsed.type).toBe("turn_usage");
		expect(parsed.usage.totalTokens).toBe(140);
	});

	test("dedupes by stable content hash", async () => {
		const database = await testDb();
		const first = ingestTurnUsage(database.client, record());
		const second = ingestTurnUsage(database.client, record());
		const row = database.client
			.query("SELECT COUNT(*) AS count FROM telemetry_event")
			.get() as { count: number };

		expect(first.inserted).toBe(true);
		expect(second.inserted).toBe(false);
		expect(first.hash).toBe(second.hash);
		expect(row.count).toBe(1);
	});

	test("hash is independent of object key order", () => {
		const a = turnUsageRecordSchema.parse(record());
		const b = turnUsageRecordSchema.parse(JSON.parse(JSON.stringify(record())));
		expect(telemetryHash(a)).toBe(telemetryHash(b));
	});

	test("imports jsonl and reports invalid and duplicate lines", async () => {
		const database = await testDb();
		const text = `${JSON.stringify(record())}\n${JSON.stringify(record())}\nnot json\n`;
		expect(importJsonl(database.client, text)).toEqual({
			duplicate: 1,
			inserted: 1,
			invalid: 1,
		});
	});
});

describe("ingest token", () => {
	test("authorizes bearer token with constant-length compare guard", async () => {
		const database = await testDb();
		const token = ensureStoredIngestToken(database.client);
		expect(authorizedBearer(`Bearer ${token}`, token)).toBe(true);
		expect(authorizedBearer("Bearer wrong", token)).toBe(false);
		expect(authorizedBearer(null, token)).toBe(false);
	});

	test("rotates the stored token", async () => {
		const database = await testDb();
		const first = ensureStoredIngestToken(database.client);
		const second = rotateStoredIngestToken(database.client);
		expect(second).not.toBe(first);
		expect(ensureStoredIngestToken(database.client)).toBe(second);
	});
});
