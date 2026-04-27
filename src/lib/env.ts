import { join } from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const developmentSecret =
	"development-only-secret-change-before-production-123456";

export const env = createEnv({
	server: {
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		PORT: z.coerce.number().int().positive().default(3000),
		DATA_DIR: z.string().min(1).default("./data"),
		DB_PATH: z.string().min(1).optional(),
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

export const databasePath =
	env.DB_PATH ?? join(env.DATA_DIR, "pi-telemetry-web.sqlite");
