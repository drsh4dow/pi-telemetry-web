import { sql } from "drizzle-orm";
import {
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.default(false)
		.notNull(),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => new Date())
		.notNull(),
});

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", {
			mode: "timestamp_ms",
		}),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", {
			mode: "timestamp_ms",
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = sqliteTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const telemetryEvent = sqliteTable(
	"telemetry_event",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		hash: text("hash").notNull(),
		createdAtMs: integer("created_at_ms").notNull(),
		eventTimestampMs: integer("event_timestamp_ms").notNull(),
		schemaVersion: integer("schema_version").notNull(),
		type: text("type").notNull(),
		turnIndex: integer("turn_index").notNull(),
		stopReason: text("stop_reason"),
		sessionId: text("session_id").notNull(),
		sessionFile: text("session_file"),
		cwd: text("cwd").notNull(),
		cwdName: text("cwd_name").notNull(),
		api: text("api").notNull(),
		provider: text("provider").notNull(),
		model: text("model").notNull(),
		team: text("team"),
		project: text("project"),
		developer: text("developer"),
		gitRoot: text("git_root"),
		gitRemote: text("git_remote"),
		gitBranch: text("git_branch"),
		gitCommit: text("git_commit"),
		gitUserName: text("git_user_name"),
		gitUserEmail: text("git_user_email"),
		inputTokens: integer("input_tokens").notNull(),
		outputTokens: integer("output_tokens").notNull(),
		cacheReadTokens: integer("cache_read_tokens").notNull(),
		cacheWriteTokens: integer("cache_write_tokens").notNull(),
		totalTokens: integer("total_tokens").notNull(),
		costInput: real("cost_input"),
		costOutput: real("cost_output"),
		costCacheRead: real("cost_cache_read"),
		costCacheWrite: real("cost_cache_write"),
		costTotal: real("cost_total"),
		rawJson: text("raw_json").notNull(),
	},
	(table) => [
		uniqueIndex("telemetry_event_hash_idx").on(table.hash),
		index("telemetry_event_timestamp_idx").on(table.eventTimestampMs),
		index("telemetry_event_project_idx").on(table.project),
		index("telemetry_event_developer_idx").on(table.developer),
		index("telemetry_event_model_idx").on(table.model),
		index("telemetry_event_provider_idx").on(table.provider),
		index("telemetry_event_team_idx").on(table.team),
	],
);

export const appSetting = sqliteTable("app_setting", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
	updatedAtMs: integer("updated_at_ms").notNull(),
});

export const migration = sqliteTable("migration", {
	id: integer("id").primaryKey(),
	name: text("name").notNull(),
	appliedAtMs: integer("applied_at_ms").notNull(),
});

export const schema = {
	account,
	appSetting,
	migration,
	session,
	telemetryEvent,
	user,
	verification,
};
