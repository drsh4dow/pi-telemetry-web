import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDashboardData } from "../src/lib/dashboard";
import {
	migrateDatabase,
	openTelemetryDatabase,
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
	const database = openTelemetryDatabase(join(dir, "test.sqlite"));
	databases.push(database);
	migrateDatabase(database.client);
	return database;
}

function record(
	project: string,
	developer: string,
	model: string,
	totalTokens: number,
	cost: number,
) {
	return {
		schemaVersion: 1,
		type: "turn_usage",
		timestamp: "2026-01-02T03:04:05.000Z",
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
	test("summarizes and filters events", async () => {
		const database = await testDb();
		ingestTurnUsage(
			database.client,
			record("alpha", "a@example.com", "sonnet", 100, 0.01),
		);
		ingestTurnUsage(
			database.client,
			record("beta", "b@example.com", "opus", 200, 0.02),
		);

		const all = getDashboardData(database.client, {});
		const filtered = getDashboardData(database.client, { project: "alpha" });

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
