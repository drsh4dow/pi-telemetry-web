import { createFileRoute } from "@tanstack/react-router";
import { appDatabase, appReady, dbGet } from "~/lib/database";

export const Route = createFileRoute("/healthz")({
	server: {
		handlers: {
			GET: async () => {
				try {
					await appReady;
					await dbGet(appDatabase.client, "SELECT 1");
					await dbGet(
						appDatabase.client,
						"SELECT 1 FROM migration ORDER BY id DESC LIMIT 1",
					);
					return Response.json({ ok: true });
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					return Response.json({ error: message }, { status: 503 });
				}
			},
		},
	},
});
