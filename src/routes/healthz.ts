import { createFileRoute } from "@tanstack/react-router";
import { appDatabase } from "~/lib/database";

export const Route = createFileRoute("/healthz")({
	server: {
		handlers: {
			GET: async () => {
				try {
					appDatabase.client.query("SELECT 1").get();
					appDatabase.client
						.query("SELECT 1 FROM migration ORDER BY id DESC LIMIT 1")
						.get();
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
