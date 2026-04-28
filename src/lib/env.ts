import { join } from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const developmentSecret =
	"development-only-secret-change-before-production-123456";

const booleanEnv = z
	.enum(["true", "false"])
	.default("true")
	.transform((value) => value === "true");

export const env = createEnv({
	server: {
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		PORT: z.coerce.number().int().positive().default(3000),
		DATABASE_BACKEND: z.enum(["local", "turso"]).default("local"),
		DATA_DIR: z.string().min(1).default("./data"),
		DB_PATH: z.string().min(1).optional(),
		TURSO_DATABASE_URL: z.string().min(1).optional(),
		TURSO_AUTH_TOKEN: z.string().min(1).optional(),
		MIGRATE_ON_STARTUP: booleanEnv,
		BETTER_AUTH_SECRET: z.string().min(32).default(developmentSecret),
		BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
		PI_TELEMETRY_INGEST_TOKEN: z.string().min(16).optional(),
	},
	clientPrefix: "PUBLIC_",
	client: {},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});

if (
	env.NODE_ENV === "production" &&
	env.BETTER_AUTH_SECRET === developmentSecret
) {
	throw new Error("BETTER_AUTH_SECRET must be set in production");
}

export type DatabaseConfig =
	| {
			backend: "local";
			path: string;
			url: string;
	  }
	| {
			backend: "turso";
			url: string;
			authToken: string;
	  };

function localDatabaseUrl(path: string): string {
	return path.startsWith("file:") ? path : `file:${path}`;
}

export const databaseConfig: DatabaseConfig = (() => {
	if (env.DATABASE_BACKEND === "local") {
		const path = env.DB_PATH ?? join(env.DATA_DIR, "pi-telemetry-web.sqlite");
		return { backend: "local", path, url: localDatabaseUrl(path) };
	}

	if (!env.TURSO_DATABASE_URL) {
		throw new Error(
			"TURSO_DATABASE_URL is required when DATABASE_BACKEND=turso",
		);
	}
	if (!env.TURSO_AUTH_TOKEN) {
		throw new Error("TURSO_AUTH_TOKEN is required when DATABASE_BACKEND=turso");
	}
	return {
		backend: "turso",
		url: env.TURSO_DATABASE_URL,
		authToken: env.TURSO_AUTH_TOKEN,
	};
})();
