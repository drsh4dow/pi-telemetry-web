import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";
import { appReady } from "~/lib/database";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				await appReady;
				return auth.handler(request);
			},
			POST: async ({ request }) => {
				await appReady;
				return auth.handler(request);
			},
		},
	},
});
