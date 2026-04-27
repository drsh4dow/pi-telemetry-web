import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { useState } from "react";
import { DashboardCharts } from "~/components/dashboard-charts";
import { Button, SecondaryButton } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input, Label, Select } from "~/components/ui/form";
import type { DashboardFilters } from "~/lib/dashboard";
import { getDashboard, getSession, importTelemetryJsonl } from "~/lib/server";

export const Route = createFileRoute("/dashboard")({
	validateSearch: (search: Record<string, unknown>): DashboardFilters => ({
		from: stringSearch(search.from),
		to: stringSearch(search.to),
		team: stringSearch(search.team),
		project: stringSearch(search.project),
		developer: stringSearch(search.developer),
		model: stringSearch(search.model),
		provider: stringSearch(search.provider),
	}),
	beforeLoad: async ({ location }) => {
		const session = await getSession();
		if (!session)
			throw redirect({ to: "/login", search: { redirect: location.href } });
		return { user: session.user };
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ deps }) => getDashboard({ data: deps }),
	component: DashboardPage,
});

function stringSearch(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function DashboardPage() {
	const data = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: "/dashboard" });
	const router = useRouter();
	const [importResult, setImportResult] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	return (
		<div className="min-h-screen bg-muted/60">
			<header className="border-b bg-white">
				<div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
					<div>
						<h1 className="font-semibold text-xl">Pi Telemetry Web</h1>
						<p className="text-muted-foreground text-sm">
							Usage from pi-telemetry-minimal
						</p>
					</div>
					<nav className="flex items-center gap-3 text-sm">
						<Link to="/dashboard" className="font-medium text-primary">
							Dashboard
						</Link>
						<Link
							to="/settings"
							className="text-muted-foreground hover:text-foreground"
						>
							Settings
						</Link>
					</nav>
				</div>
			</header>
			<main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
				<section className="grid gap-4 md:grid-cols-5">
					<Metric label="Turns" value={data.summary.turns.toLocaleString()} />
					<Metric label="Tokens" value={data.summary.tokens.toLocaleString()} />
					<Metric label="Cost" value={formatCost(data.summary.cost)} />
					<Metric
						label="Developers"
						value={data.summary.developers.toLocaleString()}
					/>
					<Metric
						label="Projects"
						value={data.summary.projects.toLocaleString()}
					/>
				</section>

				<Card>
					<CardHeader>
						<CardTitle>Filters</CardTitle>
						<CardDescription>
							Date range plus label/model filters.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							className="grid gap-3 md:grid-cols-4 lg:grid-cols-7"
							onSubmit={(event) => {
								event.preventDefault();
								const form = new FormData(event.currentTarget);
								void navigate({
									search: {
										from: formString(form, "from"),
										to: formString(form, "to"),
										team: formString(form, "team"),
										project: formString(form, "project"),
										developer: formString(form, "developer"),
										model: formString(form, "model"),
										provider: formString(form, "provider"),
									},
								});
							}}
						>
							<Field label="From">
								<Input
									name="from"
									type="date"
									defaultValue={search.from ?? ""}
								/>
							</Field>
							<Field label="To">
								<Input name="to" type="date" defaultValue={search.to ?? ""} />
							</Field>
							<OptionField
								name="team"
								label="Team"
								value={search.team}
								options={data.filters.teams}
							/>
							<OptionField
								name="project"
								label="Project"
								value={search.project}
								options={data.filters.projects}
							/>
							<OptionField
								name="developer"
								label="Developer"
								value={search.developer}
								options={data.filters.developers}
							/>
							<OptionField
								name="model"
								label="Model"
								value={search.model}
								options={data.filters.models}
							/>
							<OptionField
								name="provider"
								label="Provider"
								value={search.provider}
								options={data.filters.providers}
							/>
							<div className="flex items-end gap-2 md:col-span-4 lg:col-span-7">
								<Button type="submit">Apply</Button>
								<SecondaryButton
									type="button"
									onClick={() => void navigate({ search: {} })}
								>
									Reset
								</SecondaryButton>
							</div>
						</form>
					</CardContent>
				</Card>

				<DashboardCharts data={data} />

				<Card>
					<CardHeader>
						<CardTitle>Import JSONL</CardTitle>
						<CardDescription>
							Upload an existing pi-telemetry-minimal events.jsonl file.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-white px-3 py-2 font-medium text-sm shadow-sm hover:bg-muted">
							<Upload size={16} />
							{busy ? "Importing..." : "Choose JSONL file"}
							<input
								type="file"
								accept=".jsonl,.txt,application/json"
								className="hidden"
								disabled={busy}
								onChange={async (event) => {
									const file = event.currentTarget.files?.[0];
									if (!file) return;
									setBusy(true);
									setImportResult(null);
									try {
										const result = await importTelemetryJsonl({
											data: { text: await file.text() },
										});
										setImportResult(
											`Imported ${result.inserted} events, skipped ${result.duplicate} duplicates, found ${result.invalid} invalid lines.`,
										);
										await router.invalidate();
									} catch (error) {
										setImportResult(
											error instanceof Error ? error.message : String(error),
										);
									} finally {
										setBusy(false);
										event.currentTarget.value = "";
									}
								}}
							/>
						</label>
						{importResult ? (
							<p className="mt-3 text-muted-foreground text-sm">
								{importResult}
							</p>
						) : null}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Recent events</CardTitle>
						<CardDescription>
							Newest 100 events. All captured fields are visible.
						</CardDescription>
					</CardHeader>
					<CardContent className="overflow-x-auto">
						<table className="w-full min-w-[1200px] text-left text-sm">
							<thead className="border-b text-muted-foreground">
								<tr>
									{[
										"Time",
										"Team",
										"Project",
										"Developer",
										"Provider",
										"Model",
										"Tokens",
										"Cost",
										"CWD",
										"Git",
										"Session",
									].map((heading) => (
										<th key={heading} className="px-3 py-2 font-medium">
											{heading}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{data.events.map((event) => (
									<tr key={event.id} className="border-b align-top">
										<td className="px-3 py-2">{formatDate(event.timestamp)}</td>
										<td className="px-3 py-2">{event.team ?? "—"}</td>
										<td className="px-3 py-2">{event.project ?? "—"}</td>
										<td className="px-3 py-2">{event.developer ?? "—"}</td>
										<td className="px-3 py-2">{event.provider}</td>
										<td className="px-3 py-2">{event.model}</td>
										<td className="px-3 py-2">
											{event.totalTokens.toLocaleString()}
										</td>
										<td className="px-3 py-2">
											{formatCost(event.costTotal ?? 0)}
										</td>
										<td className="max-w-64 break-all px-3 py-2">
											{event.cwd}
										</td>
										<td className="max-w-72 break-all px-3 py-2">
											{[event.gitRemote, event.gitBranch, event.gitCommit]
												.filter(Boolean)
												.join(" · ") || "—"}
										</td>
										<td className="max-w-64 break-all px-3 py-2">
											{event.sessionId}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<Card>
			<CardContent className="p-5">
				<p className="text-muted-foreground text-sm">{label}</p>
				<p className="mt-2 font-semibold text-2xl">{value}</p>
			</CardContent>
		</Card>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			{children}
		</div>
	);
}

function OptionField(props: {
	name: string;
	label: string;
	value?: string;
	options: string[];
}) {
	return (
		<Field label={props.label}>
			<Select name={props.name} defaultValue={props.value ?? ""}>
				<option value="">All</option>
				{props.options.map((option) => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</Select>
		</Field>
	);
}

function formString(form: FormData, key: string) {
	const value = String(form.get(key) ?? "").trim();
	return value || undefined;
}

function formatCost(value: number) {
	return new Intl.NumberFormat(undefined, {
		currency: "USD",
		maximumFractionDigits: 4,
		style: "currency",
	}).format(value);
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "short",
		timeStyle: "medium",
	}).format(new Date(`${value}Z`));
}
