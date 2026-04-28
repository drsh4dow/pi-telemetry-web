import { type DatabaseClient, dbAll, dbGet, dbRun } from "./database";

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

export interface DashboardSummary {
	turns: number;
	tokens: number;
	cost: number;
	developers: number;
	projects: number;
}

export interface DashboardData {
	summary: DashboardSummary;
	previous: DashboardSummary;
	window: {
		fromMs: number | null;
		toMs: number | null;
		days: number;
		bucket: "hour" | "day";
	};
	series: Array<{ date: string; turns: number; tokens: number; cost: number }>;
	modelSeries: {
		dates: string[];
		models: string[];
		/** rows aligned with dates; values are tokens per model on that date. */
		values: Array<Record<string, number>>;
	};
	heatmap: {
		/** 7 weekdays (0=Sun) × 24 hours, value = total tokens. */
		cells: number[][];
		max: number;
	};
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

const DAY_MS = 86_400_000;

function timestampMs(
	value: string | undefined,
	endOfDay = false,
): number | undefined {
	if (!value) return undefined;
	const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
	const timestamp = value.includes("T") ? value : `${value}${suffix}`;
	const zonedTimestamp = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)
		? timestamp
		: `${timestamp}Z`;
	const parsed = Date.parse(zonedTimestamp);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function whereClause(
	filters: DashboardFilters,
	override?: { fromMs?: number; toMs?: number },
) {
	const clauses: string[] = [];
	const params: Array<string | number> = [];
	const fromMs =
		override?.fromMs !== undefined
			? override.fromMs
			: timestampMs(filters.from);
	const toMs =
		override?.toMs !== undefined
			? override.toMs
			: timestampMs(filters.to, true);
	if (fromMs !== undefined) {
		clauses.push("event_timestamp_ms >= ?");
		params.push(fromMs);
	}
	if (toMs !== undefined) {
		clauses.push("event_timestamp_ms <= ?");
		params.push(toMs);
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
		fromMs,
		toMs,
	};
}

async function stringList(
	client: DatabaseClient,
	column: string,
): Promise<string[]> {
	const rows = await dbAll<{ value: string }>(
		client,
		`SELECT DISTINCT ${column} AS value FROM telemetry_event WHERE ${column} IS NOT NULL AND ${column} != '' ORDER BY ${column}`,
	);
	return rows.map((row) => row.value);
}

async function summaryFor(
	client: DatabaseClient,
	filters: DashboardFilters,
	override?: { fromMs?: number; toMs?: number },
): Promise<DashboardSummary> {
	const where = whereClause(filters, override);
	const row = await dbGet<DashboardSummary>(
		client,
		`SELECT
			COUNT(*) AS turns,
			COALESCE(SUM(total_tokens), 0) AS tokens,
			COALESCE(SUM(cost_total), 0) AS cost,
			COUNT(DISTINCT developer) AS developers,
			COUNT(DISTINCT project) AS projects
		FROM telemetry_event ${where.sql}`,
		where.params,
	);
	return row ?? { cost: 0, developers: 0, projects: 0, tokens: 0, turns: 0 };
}

export async function getDashboardData(
	client: DatabaseClient,
	filters: DashboardFilters,
): Promise<DashboardData> {
	const where = whereClause(filters);

	// Resolve effective window for prev-period comparison.
	const nowMs = Date.now();
	const span = await dbGet<{ minMs: number | null; maxMs: number | null }>(
		client,
		`SELECT MIN(event_timestamp_ms) AS minMs, MAX(event_timestamp_ms) AS maxMs FROM telemetry_event ${where.sql}`,
		where.params,
	);
	const effectiveFrom = where.fromMs ?? span?.minMs ?? nowMs;
	const effectiveTo = where.toMs ?? span?.maxMs ?? nowMs;
	const windowSpan = Math.max(effectiveTo - effectiveFrom, DAY_MS);
	const days = Math.max(1, Math.round(windowSpan / DAY_MS));

	const summary = await summaryFor(client, filters);
	const previous = await summaryFor(client, filters, {
		fromMs: effectiveFrom - windowSpan,
		toMs: effectiveFrom - 1,
	});

	// Bucket by hour when the window is short (≤2 days), otherwise by day.
	const bucket: "hour" | "day" = windowSpan <= 2 * DAY_MS ? "hour" : "day";
	const bucketExpr =
		bucket === "hour"
			? "strftime('%Y-%m-%d %H:00', event_timestamp_ms / 1000, 'unixepoch')"
			: "date(event_timestamp_ms / 1000, 'unixepoch')";

	const series = await dbAll<DashboardData["series"][number]>(
		client,
		`SELECT
			${bucketExpr} AS date,
			COUNT(*) AS turns,
			COALESCE(SUM(total_tokens), 0) AS tokens,
			COALESCE(SUM(cost_total), 0) AS cost
		FROM telemetry_event ${where.sql}
		GROUP BY date
		ORDER BY date`,
		where.params,
	);

	const group = (column: string) =>
		dbAll<{
			name: string;
			turns: number;
			tokens: number;
			cost: number;
		}>(
			client,
			`SELECT
				COALESCE(${column}, 'Unknown') AS name,
				COUNT(*) AS turns,
				COALESCE(SUM(total_tokens), 0) AS tokens,
				COALESCE(SUM(cost_total), 0) AS cost
			FROM telemetry_event ${where.sql}
			GROUP BY name
			ORDER BY tokens DESC
			LIMIT 8`,
			where.params,
		);

	// Stacked area: top 5 models by tokens, with "Others" bucket per day.
	const topModels = (
		await dbAll<{ name: string; tokens: number }>(
			client,
			`SELECT model AS name, COALESCE(SUM(total_tokens), 0) AS tokens
			 FROM telemetry_event ${where.sql}
			 GROUP BY model
			 ORDER BY tokens DESC
			 LIMIT 5`,
			where.params,
		)
	).map((row) => row.name);

	const perDayModel = await dbAll<{
		date: string;
		model: string;
		tokens: number;
	}>(
		client,
		`SELECT
			${bucketExpr} AS date,
			model,
			COALESCE(SUM(total_tokens), 0) AS tokens
		FROM telemetry_event ${where.sql}
		GROUP BY date, model
		ORDER BY date`,
		where.params,
	);

	const dates = series.map((s) => s.date);
	const modelSet = new Set(topModels);
	const modelLabels = [...topModels];
	const hasOthers = perDayModel.some((row) => !modelSet.has(row.model));
	if (hasOthers) modelLabels.push("Others");
	const valuesByDate = new Map<string, Record<string, number>>();
	for (const date of dates) {
		const entry: Record<string, number> = {};
		for (const m of modelLabels) entry[m] = 0;
		valuesByDate.set(date, entry);
	}
	for (const row of perDayModel) {
		const entry = valuesByDate.get(row.date);
		if (!entry) continue;
		const key = modelSet.has(row.model) ? row.model : "Others";
		entry[key] = (entry[key] ?? 0) + row.tokens;
	}
	const modelValues = dates.map((d) => valuesByDate.get(d) ?? {});

	// Heatmap: weekday (0=Sun) × hour, total tokens.
	const cells: number[][] = Array.from({ length: 7 }, () =>
		Array.from({ length: 24 }, () => 0),
	);
	const heatRows = await dbAll<{
		dow: number;
		hour: number;
		tokens: number;
	}>(
		client,
		`SELECT
			CAST(strftime('%w', event_timestamp_ms / 1000, 'unixepoch') AS INTEGER) AS dow,
			CAST(strftime('%H', event_timestamp_ms / 1000, 'unixepoch') AS INTEGER) AS hour,
			COALESCE(SUM(total_tokens), 0) AS tokens
		FROM telemetry_event ${where.sql}
		GROUP BY dow, hour`,
		where.params,
	);
	let heatMax = 0;
	for (const row of heatRows) {
		if (row.dow < 0 || row.dow > 6 || row.hour < 0 || row.hour > 23) continue;
		const dowRow = cells[row.dow];
		if (!dowRow) continue;
		dowRow[row.hour] = row.tokens;
		if (row.tokens > heatMax) heatMax = row.tokens;
	}

	const events = await dbAll<DashboardEvent>(
		client,
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
		where.params,
	);

	return {
		summary,
		previous,
		window: {
			fromMs: where.fromMs ?? null,
			toMs: where.toMs ?? null,
			days,
			bucket,
		},
		series,
		modelSeries: { dates, models: modelLabels, values: modelValues },
		heatmap: { cells, max: heatMax },
		byProject: await group("project"),
		byDeveloper: await group("developer"),
		byModel: await group("model"),
		filters: {
			teams: await stringList(client, "team"),
			projects: await stringList(client, "project"),
			developers: await stringList(client, "developer"),
			models: await stringList(client, "model"),
			providers: await stringList(client, "provider"),
		},
		events,
	};
}

export async function clearTelemetry(client: DatabaseClient): Promise<void> {
	await dbRun(client, "DELETE FROM telemetry_event");
}
