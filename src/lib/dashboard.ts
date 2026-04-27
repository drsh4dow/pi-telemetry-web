import type { Database } from "bun:sqlite";

export interface DashboardFilters {
	from?: string;
	to?: string;
	team?: string;
	project?: string;
	developer?: string;
	model?: string;
	provider?: string;
}

export interface DashboardEvent {
	id: number;
	timestamp: string;
	turnIndex: number;
	sessionId: string;
	sessionFile: string | null;
	cwd: string;
	cwdName: string;
	api: string;
	provider: string;
	model: string;
	team: string | null;
	project: string | null;
	developer: string | null;
	gitRoot: string | null;
	gitRemote: string | null;
	gitBranch: string | null;
	gitCommit: string | null;
	gitUserName: string | null;
	gitUserEmail: string | null;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	totalTokens: number;
	costTotal: number | null;
	rawJson: string;
}

export interface DashboardData {
	summary: {
		turns: number;
		tokens: number;
		cost: number;
		developers: number;
		projects: number;
	};
	series: Array<{ date: string; turns: number; tokens: number; cost: number }>;
	byProject: Array<{
		name: string;
		turns: number;
		tokens: number;
		cost: number;
	}>;
	byDeveloper: Array<{
		name: string;
		turns: number;
		tokens: number;
		cost: number;
	}>;
	byModel: Array<{ name: string; turns: number; tokens: number; cost: number }>;
	filters: {
		teams: string[];
		projects: string[];
		developers: string[];
		models: string[];
		providers: string[];
	};
	events: DashboardEvent[];
}

function timestampMs(
	value: string | undefined,
	endOfDay = false,
): number | undefined {
	if (!value) return undefined;
	const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
	const parsed = Date.parse(value.includes("T") ? value : `${value}${suffix}`);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function whereClause(filters: DashboardFilters) {
	const clauses: string[] = [];
	const params: Array<string | number> = [];
	const from = timestampMs(filters.from);
	const to = timestampMs(filters.to, true);
	if (from !== undefined) {
		clauses.push("event_timestamp_ms >= ?");
		params.push(from);
	}
	if (to !== undefined) {
		clauses.push("event_timestamp_ms <= ?");
		params.push(to);
	}
	for (const [column, value] of [
		["team", filters.team],
		["project", filters.project],
		["developer", filters.developer],
		["model", filters.model],
		["provider", filters.provider],
	] as const) {
		if (!value) continue;
		clauses.push(`${column} = ?`);
		params.push(value);
	}
	return {
		sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
		params,
	};
}

function stringList(client: Database, column: string): string[] {
	return (
		client
			.query(
				`SELECT DISTINCT ${column} AS value FROM telemetry_event WHERE ${column} IS NOT NULL AND ${column} != '' ORDER BY ${column}`,
			)
			.all() as Array<{ value: string }>
	).map((row) => row.value);
}

export function getDashboardData(
	client: Database,
	filters: DashboardFilters,
): DashboardData {
	const where = whereClause(filters);
	const summary = client
		.query(
			`SELECT
				COUNT(*) AS turns,
				COALESCE(SUM(total_tokens), 0) AS tokens,
				COALESCE(SUM(cost_total), 0) AS cost,
				COUNT(DISTINCT developer) AS developers,
				COUNT(DISTINCT project) AS projects
			FROM telemetry_event ${where.sql}`,
		)
		.get(...where.params) as DashboardData["summary"] | null;

	const series = client
		.query(
			`SELECT
				date(event_timestamp_ms / 1000, 'unixepoch') AS date,
				COUNT(*) AS turns,
				COALESCE(SUM(total_tokens), 0) AS tokens,
				COALESCE(SUM(cost_total), 0) AS cost
			FROM telemetry_event ${where.sql}
			GROUP BY date
			ORDER BY date`,
		)
		.all(...where.params) as DashboardData["series"];

	const group = (column: string) =>
		client
			.query(
				`SELECT
					COALESCE(${column}, 'Unknown') AS name,
					COUNT(*) AS turns,
					COALESCE(SUM(total_tokens), 0) AS tokens,
					COALESCE(SUM(cost_total), 0) AS cost
				FROM telemetry_event ${where.sql}
				GROUP BY name
				ORDER BY tokens DESC
				LIMIT 8`,
			)
			.all(...where.params) as Array<{
			name: string;
			turns: number;
			tokens: number;
			cost: number;
		}>;

	const events = client
		.query(
			`SELECT
				id,
				datetime(event_timestamp_ms / 1000, 'unixepoch') AS timestamp,
				turn_index AS turnIndex,
				session_id AS sessionId,
				session_file AS sessionFile,
				cwd,
				cwd_name AS cwdName,
				api,
				provider,
				model,
				team,
				project,
				developer,
				git_root AS gitRoot,
				git_remote AS gitRemote,
				git_branch AS gitBranch,
				git_commit AS gitCommit,
				git_user_name AS gitUserName,
				git_user_email AS gitUserEmail,
				input_tokens AS inputTokens,
				output_tokens AS outputTokens,
				cache_read_tokens AS cacheReadTokens,
				cache_write_tokens AS cacheWriteTokens,
				total_tokens AS totalTokens,
				cost_total AS costTotal,
				raw_json AS rawJson
			FROM telemetry_event ${where.sql}
			ORDER BY event_timestamp_ms DESC, id DESC
			LIMIT 100`,
		)
		.all(...where.params) as DashboardEvent[];

	return {
		summary: summary ?? {
			cost: 0,
			developers: 0,
			projects: 0,
			tokens: 0,
			turns: 0,
		},
		series,
		byProject: group("project"),
		byDeveloper: group("developer"),
		byModel: group("model"),
		filters: {
			teams: stringList(client, "team"),
			projects: stringList(client, "project"),
			developers: stringList(client, "developer"),
			models: stringList(client, "model"),
			providers: stringList(client, "provider"),
		},
		events,
	};
}

export function clearTelemetry(client: Database): void {
	client.query("DELETE FROM telemetry_event").run();
}
