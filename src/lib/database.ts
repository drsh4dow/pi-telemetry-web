import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { databasePath } from "./env";
import { schema } from "./schema";

export interface TelemetryDatabase {
	client: Database;
	db: ReturnType<typeof drizzle<typeof schema>>;
}

const migrations = [
	{
		id: 1,
		name: "initial_schema",
		sql: `
CREATE TABLE IF NOT EXISTS migration (
	id integer PRIMARY KEY,
	name text NOT NULL,
	applied_at_ms integer NOT NULL
);

CREATE TABLE IF NOT EXISTS user (
	id text PRIMARY KEY,
	name text NOT NULL,
	email text NOT NULL UNIQUE,
	email_verified integer NOT NULL DEFAULT 0,
	image text,
	created_at integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
	updated_at integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);

CREATE TABLE IF NOT EXISTS session (
	id text PRIMARY KEY,
	expires_at integer NOT NULL,
	token text NOT NULL UNIQUE,
	created_at integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
	updated_at integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
	ip_address text,
	user_agent text,
	user_id text NOT NULL REFERENCES user(id) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS session_user_id_idx ON session(user_id);

CREATE TABLE IF NOT EXISTS account (
	id text PRIMARY KEY,
	account_id text NOT NULL,
	provider_id text NOT NULL,
	user_id text NOT NULL REFERENCES user(id) ON DELETE cascade,
	access_token text,
	refresh_token text,
	id_token text,
	access_token_expires_at integer,
	refresh_token_expires_at integer,
	scope text,
	password text,
	created_at integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
	updated_at integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);
CREATE INDEX IF NOT EXISTS account_user_id_idx ON account(user_id);

CREATE TABLE IF NOT EXISTS verification (
	id text PRIMARY KEY,
	identifier text NOT NULL,
	value text NOT NULL,
	expires_at integer NOT NULL,
	created_at integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
	updated_at integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);

CREATE TABLE IF NOT EXISTS telemetry_event (
	id integer PRIMARY KEY AUTOINCREMENT,
	hash text NOT NULL UNIQUE,
	created_at_ms integer NOT NULL,
	event_timestamp_ms integer NOT NULL,
	schema_version integer NOT NULL,
	type text NOT NULL,
	turn_index integer NOT NULL,
	session_id text NOT NULL,
	session_file text,
	cwd text NOT NULL,
	cwd_name text NOT NULL,
	api text NOT NULL,
	provider text NOT NULL,
	model text NOT NULL,
	team text,
	project text,
	developer text,
	git_root text,
	git_remote text,
	git_branch text,
	git_commit text,
	git_user_name text,
	git_user_email text,
	input_tokens integer NOT NULL,
	output_tokens integer NOT NULL,
	cache_read_tokens integer NOT NULL,
	cache_write_tokens integer NOT NULL,
	total_tokens integer NOT NULL,
	cost_input real,
	cost_output real,
	cost_cache_read real,
	cost_cache_write real,
	cost_total real,
	raw_json text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS telemetry_event_hash_idx ON telemetry_event(hash);
CREATE INDEX IF NOT EXISTS telemetry_event_timestamp_idx ON telemetry_event(event_timestamp_ms);
CREATE INDEX IF NOT EXISTS telemetry_event_project_idx ON telemetry_event(project);
CREATE INDEX IF NOT EXISTS telemetry_event_developer_idx ON telemetry_event(developer);
CREATE INDEX IF NOT EXISTS telemetry_event_model_idx ON telemetry_event(model);
CREATE INDEX IF NOT EXISTS telemetry_event_provider_idx ON telemetry_event(provider);
CREATE INDEX IF NOT EXISTS telemetry_event_team_idx ON telemetry_event(team);

CREATE TABLE IF NOT EXISTS app_setting (
	key text PRIMARY KEY,
	value text NOT NULL,
	updated_at_ms integer NOT NULL
);
`,
	},
];

export function openTelemetryDatabase(path: string): TelemetryDatabase {
	if (path !== ":memory:") {
		mkdirSync(dirname(path), { recursive: true });
	}
	const client = new Database(path, { create: true });
	client.exec("PRAGMA foreign_keys = ON");
	client.exec("PRAGMA journal_mode = WAL");
	return { client, db: drizzle({ client, schema }) };
}

export function migrateDatabase(client: Database): void {
	client.exec("PRAGMA foreign_keys = ON");
	client.exec("BEGIN");
	try {
		client.exec(
			"CREATE TABLE IF NOT EXISTS migration (id integer PRIMARY KEY, name text NOT NULL, applied_at_ms integer NOT NULL)",
		);
		const hasMigration = client.query("SELECT 1 FROM migration WHERE id = ?");
		const insertMigration = client.query(
			"INSERT INTO migration (id, name, applied_at_ms) VALUES (?, ?, ?)",
		);
		for (const migration of migrations) {
			if (hasMigration.get(migration.id)) continue;
			client.exec(migration.sql);
			insertMigration.run(migration.id, migration.name, Date.now());
		}
		client.exec("COMMIT");
	} catch (error) {
		client.exec("ROLLBACK");
		throw error;
	}
}

export const appDatabase = openTelemetryDatabase(databasePath);
migrateDatabase(appDatabase.client);
