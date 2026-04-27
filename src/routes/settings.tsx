import { Dialog } from "@base-ui/react/dialog";
import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { Button, DangerButton, SecondaryButton } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { ConfirmDialog } from "~/components/ui/dialog";
import {
	clearTelemetryEvents,
	getSession,
	getSettings,
	rotateIngestToken,
} from "~/lib/server";

export const Route = createFileRoute("/settings")({
	beforeLoad: async ({ location }) => {
		const session = await getSession();
		if (!session)
			throw redirect({ to: "/login", search: { redirect: location.href } });
		return { user: session.user };
	},
	loader: async () => getSettings(),
	component: SettingsPage,
});

function SettingsPage() {
	const settings = Route.useLoaderData();
	const router = useRouter();
	const [message, setMessage] = useState<string | null>(null);
	const [clearOpen, setClearOpen] = useState(false);
	const origin =
		typeof window === "undefined"
			? "https://your-domain.example"
			: window.location.origin;
	const ingestUrl = `${origin}${settings.ingestPath}`;
	const config = `{
  "sinks": {
    "webhook": {
      "url": "${ingestUrl}",
      "token": "${settings.ingestToken}",
      "timeoutMs": 2000
    }
  }
}`;

	return (
		<div className="min-h-screen bg-background">
			<header className="sticky top-0 z-30 border-border border-b bg-background/80 backdrop-blur">
				<div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
					<Link to="/dashboard" className="flex items-center gap-2.5">
						<span className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background">
							<span className="font-semibold text-sm leading-none">π</span>
						</span>
						<span className="font-semibold text-sm">Pi Telemetry</span>
					</Link>
					<nav className="flex items-center gap-1">
						<Link
							to="/dashboard"
							className="rounded-md px-3 py-1.5 font-medium text-sm text-muted-foreground transition-colors hover:text-foreground"
						>
							Dashboard
						</Link>
						<Link
							to="/settings"
							className="rounded-md bg-accent px-3 py-1.5 font-medium text-sm text-foreground"
						>
							Settings
						</Link>
					</nav>
				</div>
			</header>
			<main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				<Card>
					<CardHeader>
						<CardTitle>Webhook ingestion</CardTitle>
						<CardDescription>
							Configure pi-telemetry-minimal to POST events here.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<p className="font-medium text-sm">Ingest URL</p>
							<code className="mt-2 block overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-sm">
								{ingestUrl}
							</code>
						</div>
						<div>
							<p className="font-medium text-sm">Bearer token</p>
							<code className="mt-2 block break-all rounded-md border border-border bg-muted/40 p-3 font-mono text-sm">
								{settings.ingestToken}
							</code>
							{settings.envTokenOverride ? (
								<p className="mt-2 text-muted-foreground text-sm">
									Token is controlled by PI_TELEMETRY_INGEST_TOKEN.
								</p>
							) : null}
						</div>
						<div>
							<p className="font-medium text-sm">
								~/.pi/telemetry-minimal.json
							</p>
							<pre className="mt-2 overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-sm leading-relaxed">
								{config}
							</pre>
						</div>
						<div className="flex gap-2">
							<Button
								type="button"
								onClick={() => {
									void navigator.clipboard.writeText(config);
									setMessage("Config copied.");
								}}
							>
								Copy config
							</Button>
							<SecondaryButton
								type="button"
								disabled={settings.envTokenOverride}
								onClick={async () => {
									try {
										await rotateIngestToken();
										setMessage(
											"Token rotated. Update every pi-telemetry-minimal config.",
										);
										await router.invalidate();
									} catch (error) {
										setMessage(
											error instanceof Error ? error.message : String(error),
										);
									}
								}}
							>
								Rotate token
							</SecondaryButton>
						</div>
						{message ? (
							<p className="text-muted-foreground text-sm">{message}</p>
						) : null}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Maintenance</CardTitle>
						<CardDescription>
							Clear imported and ingested telemetry events. Auth data and
							settings stay intact.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<DangerButton type="button" onClick={() => setClearOpen(true)}>
							Clear all telemetry
						</DangerButton>
					</CardContent>
				</Card>
			</main>

			<ConfirmDialog
				open={clearOpen}
				onOpenChange={setClearOpen}
				title="Clear all telemetry?"
				description="This deletes every telemetry event from the dashboard. It cannot be undone."
			>
				<Dialog.Close
					render={<SecondaryButton type="button">Cancel</SecondaryButton>}
				/>
				<DangerButton
					type="button"
					onClick={async () => {
						await clearTelemetryEvents();
						setClearOpen(false);
						setMessage("Telemetry cleared.");
						await router.invalidate();
					}}
				>
					Clear telemetry
				</DangerButton>
			</ConfirmDialog>
		</div>
	);
}
