import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSetupState } from "~/lib/server";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const setup = await getSetupState();
		throw redirect({ to: setup.required ? "/setup" : "/dashboard" });
	},
});
