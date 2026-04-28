import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { appDatabase, appReady, dbGet } from "./database";
import { env } from "./env";
import { schema } from "./schema";

export async function userCount(): Promise<number> {
	await appReady;
	const row = await dbGet<{ count: number }>(
		appDatabase.client,
		"SELECT COUNT(*) AS count FROM user",
	);
	return row?.count ?? 0;
}

export async function setupRequired(): Promise<boolean> {
	return (await userCount()) === 0;
}

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(appDatabase.db, {
		provider: "sqlite",
		schema,
	}),
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		autoSignIn: true,
	},
	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			if (ctx.path !== "/sign-up/email") return;
			if (await setupRequired()) return;
			throw new APIError("BAD_REQUEST", {
				message: "The initial admin user already exists.",
			});
		}),
	},
	plugins: [tanstackStartCookies()],
});
