import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { type DatabaseClient, dbGet, dbRun } from "./database";
import { env } from "./env";

const optionalCleanString = z
	.string()
	.trim()
	.min(1)
	.optional()
	.or(z.literal("").transform(() => undefined));

const tokenCountSchema = z.number().int().nonnegative();
const costPartSchema = z.number().finite().nonnegative();

const costSchema = z
	.object({
		input: costPartSchema.optional(),
		output: costPartSchema.optional(),
		cacheRead: costPartSchema.optional(),
		cacheWrite: costPartSchema.optional(),
		total: costPartSchema.optional(),
	})
	.passthrough()
	.transform((cost) => ({
		...cost,
		total:
			cost.total ??
			(cost.input ?? 0) +
				(cost.output ?? 0) +
				(cost.cacheRead ?? 0) +
				(cost.cacheWrite ?? 0),
	}))
	.nullish();

const usageSchema = z
	.object({
		input: tokenCountSchema,
		output: tokenCountSchema,
		cacheRead: tokenCountSchema,
		cacheWrite: tokenCountSchema,
		totalTokens: tokenCountSchema.optional(),
		cost: costSchema,
	})
	.superRefine((usage, ctx) => {
		const total =
			usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
		if (usage.totalTokens !== undefined && usage.totalTokens !== total) {
			ctx.addIssue({
				code: "custom",
				message: "totalTokens must equal token component sum",
				path: ["totalTokens"],
			});
		}
	})
	.transform((usage) => ({
		...usage,
		totalTokens:
			usage.totalTokens ??
			usage.input + usage.output + usage.cacheRead + usage.cacheWrite,
	}));

export const turnUsageRecordSchema = z
	.object({
		schemaVersion: z.literal(1),
		type: z.literal("turn_usage"),
		timestamp: z.iso.datetime(),
		turn: z.object({ index: z.number().int().nonnegative() }),
		session: z.object({
			id: z.string().min(1),
			file: optionalCleanString,
			cwd: z.string().min(1),
			cwdName: z.string().min(1),
		}),
		model: z.object({
			api: z.string().min(1),
			provider: z.string().min(1),
			model: z.string().min(1),
		}),
		labels: z
			.object({
				team: optionalCleanString,
				project: optionalCleanString,
				developer: optionalCleanString,
			})
			.default({}),
		git: z
			.object({
				root: optionalCleanString,
				remote: optionalCleanString,
				branch: optionalCleanString,
				commit: optionalCleanString,
				userName: optionalCleanString,
				userEmail: optionalCleanString,
			})
			.optional(),
		usage: usageSchema,
	})
	.passthrough();

export type TurnUsageRecord = z.infer<typeof turnUsageRecordSchema>;

export interface IngestResult {
	inserted: boolean;
	hash: string;
}

export function stableJson(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value))
		return `[${value.map((item) => stableJson(item)).join(",")}]`;
	const object = value as Record<string, unknown>;
	return `{${Object.keys(object)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
		.join(",")}}`;
}

export function telemetryHash(record: TurnUsageRecord): string {
	return createHash("sha256").update(stableJson(record)).digest("hex");
}

export async function expectedIngestToken(
	client: DatabaseClient,
): Promise<string> {
	if (env.PI_TELEMETRY_INGEST_TOKEN) return env.PI_TELEMETRY_INGEST_TOKEN;
	return ensureStoredIngestToken(client);
}

export async function ensureStoredIngestToken(
	client: DatabaseClient,
): Promise<string> {
	const existing = await dbGet<{ value: string }>(
		client,
		"SELECT value FROM app_setting WHERE key = 'ingest_token'",
	);
	if (existing) return existing.value;
	const token =
		crypto.randomUUID().replaceAll("-", "") +
		crypto.randomUUID().replaceAll("-", "");
	await dbRun(
		client,
		"INSERT INTO app_setting (key, value, updated_at_ms) VALUES ('ingest_token', ?, ?)",
		[token, Date.now()],
	);
	return token;
}

export async function rotateStoredIngestToken(
	client: DatabaseClient,
): Promise<string> {
	const token =
		crypto.randomUUID().replaceAll("-", "") +
		crypto.randomUUID().replaceAll("-", "");
	await dbRun(
		client,
		"INSERT INTO app_setting (key, value, updated_at_ms) VALUES ('ingest_token', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at_ms = excluded.updated_at_ms",
		[token, Date.now()],
	);
	return token;
}

export function authorizedBearer(
	authorization: string | null,
	token: string,
): boolean {
	const prefix = "Bearer ";
	if (!authorization?.startsWith(prefix)) return false;
	const provided = authorization.slice(prefix.length).trim();
	const providedBuffer = Buffer.from(provided);
	const tokenBuffer = Buffer.from(token);
	if (providedBuffer.length !== tokenBuffer.length) return false;
	return timingSafeEqual(providedBuffer, tokenBuffer);
}

export async function ingestTurnUsage(
	client: DatabaseClient,
	input: unknown,
): Promise<IngestResult> {
	const record = turnUsageRecordSchema.parse(input);
	const hash = telemetryHash(record);
	const eventTimestampMs = Date.parse(record.timestamp);
	if (!Number.isFinite(eventTimestampMs)) {
		throw new Error("Invalid telemetry timestamp");
	}
	const rawJson = stableJson(record);
	const rowsAffected = await dbRun(
		client,
		`INSERT OR IGNORE INTO telemetry_event (
			hash, created_at_ms, event_timestamp_ms, schema_version, type, turn_index,
			session_id, session_file, cwd, cwd_name, api, provider, model,
			team, project, developer, git_root, git_remote, git_branch, git_commit,
			git_user_name, git_user_email, input_tokens, output_tokens, cache_read_tokens,
			cache_write_tokens, total_tokens, cost_input, cost_output, cost_cache_read,
			cost_cache_write, cost_total, raw_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			hash,
			Date.now(),
			eventTimestampMs,
			record.schemaVersion,
			record.type,
			record.turn.index,
			record.session.id,
			record.session.file ?? null,
			record.session.cwd,
			record.session.cwdName,
			record.model.api,
			record.model.provider,
			record.model.model,
			record.labels.team ?? null,
			record.labels.project ?? null,
			record.labels.developer ?? null,
			record.git?.root ?? null,
			record.git?.remote ?? null,
			record.git?.branch ?? null,
			record.git?.commit ?? null,
			record.git?.userName ?? null,
			record.git?.userEmail ?? null,
			record.usage.input,
			record.usage.output,
			record.usage.cacheRead,
			record.usage.cacheWrite,
			record.usage.totalTokens,
			record.usage.cost?.input ?? null,
			record.usage.cost?.output ?? null,
			record.usage.cost?.cacheRead ?? null,
			record.usage.cost?.cacheWrite ?? null,
			record.usage.cost?.total ?? null,
			rawJson,
		],
	);
	return { inserted: rowsAffected === 1, hash };
}

export async function importJsonl(
	client: DatabaseClient,
	text: string,
): Promise<{ inserted: number; duplicate: number; invalid: number }> {
	let inserted = 0;
	let duplicate = 0;
	let invalid = 0;
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			const result = await ingestTurnUsage(client, JSON.parse(trimmed));
			if (result.inserted) inserted += 1;
			else duplicate += 1;
		} catch {
			invalid += 1;
		}
	}
	return { duplicate, inserted, invalid };
}
