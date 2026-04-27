import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input, Label } from "~/components/ui/form";
import { authClient } from "~/lib/auth-client";
import { getSetupState } from "~/lib/server";

export const Route = createFileRoute("/setup")({
	beforeLoad: async () => {
		const setup = await getSetupState();
		if (!setup.required) throw redirect({ to: "/dashboard" });
	},
	component: SetupPage,
});

function SetupPage() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	return (
		<main className="flex min-h-screen items-center justify-center bg-muted p-6">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Create the admin user</CardTitle>
					<CardDescription>
						First-run setup is disabled after this account exists.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						className="space-y-4"
						onSubmit={async (event) => {
							event.preventDefault();
							setBusy(true);
							setError(null);
							const form = new FormData(event.currentTarget);
							const email = String(form.get("email") ?? "");
							const password = String(form.get("password") ?? "");
							const name = String(form.get("name") ?? "Admin");
							const result = await authClient.signUp.email({
								email,
								name,
								password,
							});
							setBusy(false);
							if (result.error) {
								setError(result.error.message ?? "Setup failed");
								return;
							}
							await router.navigate({ to: "/dashboard" });
						}}
					>
						<div className="space-y-2">
							<Label htmlFor="name">Name</Label>
							<Input id="name" name="name" defaultValue="Admin" required />
						</div>
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								name="password"
								type="password"
								minLength={8}
								autoComplete="new-password"
								required
							/>
						</div>
						{error ? <p className="text-destructive text-sm">{error}</p> : null}
						<Button type="submit" disabled={busy} className="w-full">
							{busy ? "Creating..." : "Create admin"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</main>
	);
}
