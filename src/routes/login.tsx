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
import { getSession, getSetupState } from "~/lib/server";

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect:
			typeof search.redirect === "string" ? search.redirect : "/dashboard",
	}),
	beforeLoad: async () => {
		const setup = await getSetupState();
		if (setup.required) throw redirect({ to: "/setup" });
		const session = await getSession();
		if (session) throw redirect({ to: "/dashboard" });
	},
	component: LoginPage,
});

function LoginPage() {
	const router = useRouter();
	const search = Route.useSearch();
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	return (
		<main className="flex min-h-screen items-center justify-center bg-muted p-6">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Sign in</CardTitle>
					<CardDescription>Use the admin email and password.</CardDescription>
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
							const result = await authClient.signIn.email({ email, password });
							setBusy(false);
							if (result.error) {
								setError(result.error.message ?? "Sign in failed");
								return;
							}
							await router.navigate({ to: search.redirect });
						}}
					>
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
								autoComplete="current-password"
								required
							/>
						</div>
						{error ? <p className="text-destructive text-sm">{error}</p> : null}
						<Button type="submit" disabled={busy} className="w-full">
							{busy ? "Signing in..." : "Sign in"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</main>
	);
}
