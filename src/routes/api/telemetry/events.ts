import { createFileRoute } from "@tanstack/react-router";
import { appDatabase, appReady } from "~/lib/database";
import { isOverUtf8ByteLimit, telemetryEventMaxBodyBytes } from "~/lib/limits";
import {
	authorizedBearer,
	expectedIngestToken,
	ingestTurnUsage,
} from "~/lib/telemetry";

export const Route = createFileRoute("/api/telemetry/events")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				await appReady;
				if (
					!authorizedBearer(
						request.headers.get("authorization"),
						await expectedIngestToken(appDatabase.client),
					)
				) {
					return Response.json({ error: "Unauthorized" }, { status: 401 });
				}
				const contentType = request.headers.get("content-type") ?? "";
				if (!contentType.toLowerCase().includes("application/json")) {
					return Response.json(
						{ error: "Content-Type must be application/json" },
						{ status: 415 },
					);
				}
				const contentLength = Number(
					request.headers.get("content-length") ?? "0",
				);
				if (contentLength > telemetryEventMaxBodyBytes) {
					return Response.json({ error: "Payload too large" }, { status: 413 });
				}
				const text = await request.text();
				if (isOverUtf8ByteLimit(text, telemetryEventMaxBodyBytes)) {
					return Response.json({ error: "Payload too large" }, { status: 413 });
				}
				try {
					const result = await ingestTurnUsage(
						appDatabase.client,
						JSON.parse(text),
					);
					return Response.json(result, { status: result.inserted ? 201 : 200 });
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					return Response.json({ error: message }, { status: 400 });
				}
			},
		},
	},
});
