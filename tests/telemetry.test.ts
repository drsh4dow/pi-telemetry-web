import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	localDatabaseConfig,
	migrateDatabase,
	openTelemetryDatabase,
	prepareDatabase,
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
	const database = openTelemetryDatabase(
		localDatabaseConfig(join(dir, "test.sqlite")),
	);
	databases.push(database);
	await prepareDatabase(database, { migrate: false });
	await migrateDatabase(database.client);
	return database;
}

function record(overrides: Record<string, unknown> = {}) {
	return {
		schemaVersion: 1,
		type: "turn_usage",
		timestamp: "2026-01-02T03:04:05.000Z",
		turn: { index: 7, stopReason: "stop" },
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
		expect(parsed.turn.stopReason).toBe("stop");
		expect(parsed.usage.totalTokens).toBe(140);
	});

	test("validates the producer-owned turn_usage v1 contract fixture", async () => {
		const fixture = await Bun.file(
			"../pi-telemetry-minimal/contracts/turn-usage-v1.json",
		).json();
		const parsed = turnUsageRecordSchema.parse(fixture);

		expect(parsed.turn.stopReason).toBe("aborted");
		expect(parsed.usage.totalTokens).toBe(125);
		expect(parsed.usage.totalTokens).not.toBe(
			parsed.usage.input +
				parsed.usage.output +
				parsed.usage.cacheRead +
				parsed.usage.cacheWrite,
		);
	});

	test("derives token and cost totals from component fields", async () => {
		const database = await testDb();
		const parsed = turnUsageRecordSchema.parse(
			record({
				usage: {
					input: 100,
					output: 25,
					cacheRead: 10,
					cacheWrite: 5,
					cost: {
						input: 0.001,
						output: 0.002,
						cacheRead: 0.0001,
						cacheWrite: 0.0002,
					},
				},
			}),
		);
		expect(parsed.usage.totalTokens).toBe(140);
		expect(parsed.usage.cost?.total).toBeCloseTo(0.0033, 10);

		await ingestTurnUsage(database.client, parsed);
		const row = await database.client.execute(
			"SELECT total_tokens, cost_total FROM telemetry_event",
		);
		expect(row.rows[0]?.total_tokens).toBe(140);
		expect(row.rows[0]?.cost_total).toBeCloseTo(0.0033, 10);
	});

	test("accepts and stores provider-reported token totals", async () => {
		const database = await testDb();
		const parsed = turnUsageRecordSchema.parse(
			record({
				turn: { index: 8, stopReason: "aborted" },
				usage: {
					input: 100,
					output: 25,
					cacheRead: 10,
					cacheWrite: 5,
					totalTokens: 125,
					cost: null,
				},
			}),
		);
		expect(parsed.usage.totalTokens).toBe(125);

		await ingestTurnUsage(database.client, parsed);
		const row = await database.client.execute(
			"SELECT stop_reason, total_tokens, raw_json FROM telemetry_event",
		);
		expect(row.rows[0]?.stop_reason).toBe("aborted");
		expect(row.rows[0]?.total_tokens).toBe(125);
		expect(JSON.parse(String(row.rows[0]?.raw_json)).turn.stopReason).toBe(
			"aborted",
		);
	});

	test("rejects negative costs", () => {
		const parsed = turnUsageRecordSchema.safeParse(
			record({
				usage: {
					input: 100,
					output: 25,
					cacheRead: 10,
					cacheWrite: 5,
					totalTokens: 140,
					cost: { total: -0.01 },
				},
			}),
		);
		expect(parsed.success).toBe(false);
	});

	test("dedupes by stable content hash", async () => {
		const database = await testDb();
		const first = await ingestTurnUsage(database.client, record());
		const second = await ingestTurnUsage(database.client, record());
		const row = await database.client.execute(
			"SELECT COUNT(*) AS count FROM telemetry_event",
		);

		expect(first.inserted).toBe(true);
		expect(second.inserted).toBe(false);
		expect(first.hash).toBe(second.hash);
		expect(row.rows[0]?.count).toBe(1);
	});

	test("hash is independent of object key order", () => {
		const a = turnUsageRecordSchema.parse(record());
		const b = turnUsageRecordSchema.parse(JSON.parse(JSON.stringify(record())));
		expect(telemetryHash(a)).toBe(telemetryHash(b));
	});

	test("imports jsonl and reports invalid and duplicate lines", async () => {
		const database = await testDb();
		const text = `${JSON.stringify(record())}\n${JSON.stringify(record())}\nnot json\n`;
		expect(await importJsonl(database.client, text)).toEqual({
			duplicate: 1,
			inserted: 1,
			invalid: 1,
		});
	});
});

describe("ingest token", () => {
	test("authorizes bearer token with constant-length compare guard", async () => {
		const database = await testDb();
		const token = await ensureStoredIngestToken(database.client);
		expect(authorizedBearer(`Bearer ${token}`, token)).toBe(true);
		expect(authorizedBearer("Bearer wrong", token)).toBe(false);
		expect(authorizedBearer(null, token)).toBe(false);
	});

	test("rotates the stored token", async () => {
		const database = await testDb();
		const first = await ensureStoredIngestToken(database.client);
		const second = await rotateStoredIngestToken(database.client);
		expect(second).not.toBe(first);
		expect(await ensureStoredIngestToken(database.client)).toBe(second);
	});
});
