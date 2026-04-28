import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth, setupRequired } from "./auth";
import {
	clearTelemetry,
	type DashboardFilters,
	getDashboardData,
} from "./dashboard";
import { appDatabase, appReady } from "./database";
import { env } from "./env";
import { isOverUtf8ByteLimit, telemetryImportMaxBodyBytes } from "./limits";
import {
	ensureStoredIngestToken,
	importJsonl,
	rotateStoredIngestToken,
} from "./telemetry";

export const getSession = createServerFn({ method: "GET" }).handler(
	async () => {
		await appReady;
		const headers = getRequestHeaders();
		return auth.api.getSession({ headers });
	},
);

export const getSetupState = createServerFn({ method: "GET" }).handler(
	async () => {
		return { required: await setupRequired() };
	},
);

export const getDashboard = createServerFn({ method: "GET" })
	.inputValidator((filters: DashboardFilters) => filters)
	.handler(async ({ data }) => {
		await requireSession();
		return await getDashboardData(appDatabase.client, data ?? {});
	});

export const importTelemetryJsonl = createServerFn({ method: "POST" })
	.inputValidator((input: { text: string }) => input)
	.handler(async ({ data }) => {
		await requireSession();
		if (isOverUtf8ByteLimit(data.text, telemetryImportMaxBodyBytes)) {
			throw new Error("Import is limited to 5MB");
		}
		return await importJsonl(appDatabase.client, data.text);
	});

export const getSettings = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireSession();
		const token =
			env.PI_TELEMETRY_INGEST_TOKEN ??
			(await ensureStoredIngestToken(appDatabase.client));
		return {
			ingestPath: "/api/telemetry/events",
			ingestToken: token,
			envTokenOverride: !!env.PI_TELEMETRY_INGEST_TOKEN,
		};
	},
);

export const rotateIngestToken = createServerFn({ method: "POST" }).handler(
	async () => {
		await requireSession();
		if (env.PI_TELEMETRY_INGEST_TOKEN) {
			throw new Error(
				"PI_TELEMETRY_INGEST_TOKEN is set; rotate it in environment configuration.",
			);
		}
		return { ingestToken: await rotateStoredIngestToken(appDatabase.client) };
	},
);

export const clearTelemetryEvents = createServerFn({ method: "POST" }).handler(
	async () => {
		await requireSession();
		await clearTelemetry(appDatabase.client);
		return { ok: true };
	},
);

async function requireSession() {
	await appReady;
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });
	if (!session) throw new Error("Unauthorized");
	return session;
}
