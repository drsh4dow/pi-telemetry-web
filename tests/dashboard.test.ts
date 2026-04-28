import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDashboardData } from "../src/lib/dashboard";
import {
	localDatabaseConfig,
	migrateDatabase,
	openTelemetryDatabase,
	prepareDatabase,
	type TelemetryDatabase,
} from "../src/lib/database";
import { ingestTurnUsage } from "../src/lib/telemetry";

const tempDirs: string[] = [];
const databases: TelemetryDatabase[] = [];

afterEach(async () => {
	for (const database of databases.splice(0)) database.client.close();
	for (const dir of tempDirs.splice(0))
		await rm(dir, { recursive: true, force: true });
});

async function testDb() {
	const dir = await mkdtemp(join(tmpdir(), "pi-telemetry-web-dashboard-test-"));
	tempDirs.push(dir);
	const database = openTelemetryDatabase(
		localDatabaseConfig(join(dir, "test.sqlite")),
	);
	databases.push(database);
	await prepareDatabase(database, { migrate: false });
	await migrateDatabase(database.client);
	return database;
}

function record(
	project: string,
	developer: string,
	model: string,
	totalTokens: number,
	cost: number,
	timestamp = "2026-01-02T03:04:05.000Z",
) {
	return {
		schemaVersion: 1,
		type: "turn_usage",
		timestamp,
		turn: { index: totalTokens },
		session: {
			id: `session-${totalTokens}`,
			cwd: "/work/acme/widget",
			cwdName: "widget",
		},
		model: { api: "anthropic-messages", provider: "anthropic", model },
		labels: { team: "platform", project, developer },
		usage: {
			input: totalTokens - 10,
			output: 10,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens,
			cost: { total: cost },
		},
	};
}

describe("dashboard queries", () => {
	test("date-only filters use UTC day boundaries", async () => {
		const database = await testDb();
		await ingestTurnUsage(
			database.client,
			record(
				"alpha",
				"a@example.com",
				"sonnet",
				100,
				0.01,
				"2026-01-01T23:30:00.000Z",
			),
		);
		await ingestTurnUsage(
			database.client,
			record(
				"alpha",
				"a@example.com",
				"sonnet",
				200,
				0.02,
				"2026-01-02T00:30:00.000Z",
			),
		);
		await ingestTurnUsage(
			database.client,
			record(
				"alpha",
				"a@example.com",
				"sonnet",
				300,
				0.03,
				"2026-01-02T23:30:00.000Z",
			),
		);
		await ingestTurnUsage(
			database.client,
			record(
				"alpha",
				"a@example.com",
				"sonnet",
				400,
				0.04,
				"2026-01-03T00:30:00.000Z",
			),
		);

		const data = await getDashboardData(database.client, {
			from: "2026-01-02",
			to: "2026-01-02",
		});

		expect(data.summary.turns).toBe(2);
		expect(data.summary.tokens).toBe(500);
	});

	test("datetime filters without an explicit zone are treated as UTC", async () => {
		const database = await testDb();
		await ingestTurnUsage(
			database.client,
			record(
				"alpha",
				"a@example.com",
				"sonnet",
				100,
				0.01,
				"2026-01-02T03:00:00.000Z",
			),
		);

		const data = await getDashboardData(database.client, {
			from: "2026-01-02T00:00:00.000",
			to: "2026-01-02T04:00:00.000",
		});

		expect(data.summary.turns).toBe(1);
		expect(data.summary.tokens).toBe(100);
	});

	test("summarizes and filters events", async () => {
		const database = await testDb();
		await ingestTurnUsage(
			database.client,
			record("alpha", "a@example.com", "sonnet", 100, 0.01),
		);
		await ingestTurnUsage(
			database.client,
			record("beta", "b@example.com", "opus", 200, 0.02),
		);

		const all = await getDashboardData(database.client, {});
		const filtered = await getDashboardData(database.client, {
			project: "alpha",
		});

		expect(all.summary).toMatchObject({
			cost: 0.03,
			developers: 2,
			projects: 2,
			tokens: 300,
			turns: 2,
		});
		expect(all.filters.projects).toEqual(["alpha", "beta"]);
		expect(all.byModel.map((item) => item.name)).toContain("sonnet");
		expect(filtered.summary).toMatchObject({ tokens: 100, turns: 1 });
		expect(filtered.events).toHaveLength(1);
		expect(filtered.events[0]?.project).toBe("alpha");
	});
});
