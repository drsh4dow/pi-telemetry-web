import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DashboardCharts } from "~/components/dashboard-charts";
import { Button, GhostButton, SecondaryButton } from "~/components/ui/button";
import { Card, CardContent, SectionHeader } from "~/components/ui/card";
import { Chip } from "~/components/ui/chip";
import { Drawer } from "~/components/ui/dialog";
import { Input, Label, Select } from "~/components/ui/form";
import { Segmented } from "~/components/ui/segmented";
import { Sparkline } from "~/components/ui/sparkline";
import type {
	DashboardData,
	DashboardEvent,
	DashboardFilters,
} from "~/lib/dashboard";
import {
	deltaPercent,
	formatAbsolute,
	formatCompact,
	formatCost,
	formatCount,
	formatPercent,
	formatRelative,
} from "~/lib/format";
import { getDashboard, getSession, importTelemetryJsonl } from "~/lib/server";
import { useCountUp } from "~/lib/use-count-up";
import { cn } from "~/lib/utils";

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

const PRESETS = [
	{ value: "24h", label: "24H", days: 1 },
	{ value: "7d", label: "7D", days: 7 },
	{ value: "30d", label: "30D", days: 30 },
	{ value: "90d", label: "90D", days: 90 },
	{ value: "all", label: "All", days: 0 },
	{ value: "custom", label: "Custom", days: -1 },
] as const;
type PresetValue = (typeof PRESETS)[number]["value"];

function DashboardPage() {
	const data = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: "/dashboard" });
	const router = useRouter();
	const [importResult, setImportResult] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [drawerEvent, setDrawerEvent] = useState<DashboardEvent | null>(null);

	const activePreset = derivePreset(search);

	// Live refresh every 30s when tab visible.
	useEffect(() => {
		const id = window.setInterval(() => {
			if (document.visibilityState === "visible") {
				void router.invalidate();
			}
		}, 30_000);
		return () => window.clearInterval(id);
	}, [router]);

	function applyPreset(value: PresetValue) {
		if (value === "custom") {
			void navigate({
				search: { ...search, from: search.from, to: search.to },
			});
			return;
		}
		if (value === "all") {
			const { from: _f, to: _t, ...rest } = search;
			void navigate({ search: rest });
			return;
		}
		const days = PRESETS.find((p) => p.value === value)?.days ?? 7;
		const to = isoDate(new Date());
		const from = isoDate(new Date(Date.now() - (days - 1) * 86_400_000));
		void navigate({ search: { ...search, from, to } });
	}

	function clearFilter(key: keyof DashboardFilters) {
		const next = { ...search };
		delete next[key];
		void navigate({ search: next });
	}

	const activeChips: Array<[keyof DashboardFilters, string]> = (
		[
			["team", search.team],
			["project", search.project],
			["developer", search.developer],
			["model", search.model],
			["provider", search.provider],
		] as Array<[keyof DashboardFilters, string | undefined]>
	).filter((entry): entry is [keyof DashboardFilters, string] =>
		Boolean(entry[1]),
	);

	return (
		<div className="min-h-screen">
			<TopBar />
			<main className="mx-auto w-full max-w-[1320px] space-y-6 px-4 pb-16 sm:px-6 lg:px-8">
				<SectionHeader
					eyebrow={`Window · ${data.window.days} day${data.window.days === 1 ? "" : "s"}`}
					title="Telemetry overview"
					subtitle="Pi consumption across teams, projects, and models — refreshed every 30 seconds."
					right={
						<Segmented
							value={activePreset}
							options={PRESETS.map((p) => ({ value: p.value, label: p.label }))}
							onChange={(value) => applyPreset(value as PresetValue)}
							ariaLabel="Time range"
						/>
					}
					className="pt-8"
				/>

				<KpiStrip data={data} />

				<FilterBar
					data={data}
					search={search}
					activeChips={activeChips}
					onClearFilter={clearFilter}
					onApply={(next) => navigate({ search: next })}
				/>

				<DashboardCharts data={data} />

				<EventsCard
					events={data.events}
					onSelect={(event) => setDrawerEvent(event)}
				/>

				<ImportCard
					busy={busy}
					result={importResult}
					onImport={async (file) => {
						setBusy(true);
						setImportResult(null);
						try {
							const result = await importTelemetryJsonl({
								data: { text: await file.text() },
							});
							setImportResult(
								`Imported ${result.inserted} events · skipped ${result.duplicate} duplicates · ${result.invalid} invalid lines.`,
							);
							await router.invalidate();
						} catch (error) {
							setImportResult(
								error instanceof Error ? error.message : String(error),
							);
						} finally {
							setBusy(false);
						}
					}}
				/>
			</main>

			<EventDrawer
				event={drawerEvent}
				onOpenChange={(open) => !open && setDrawerEvent(null)}
			/>
		</div>
	);
}

/* ───────────────────────── Top bar ───────────────────────────────── */

function TopBar() {
	return (
		<header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[oklch(0.16_0.012_260_/_0.7)] backdrop-blur-xl">
			<div className="mx-auto flex w-full max-w-[1320px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
				<Link to="/dashboard" className="flex items-center gap-2.5">
					<span className="grid h-8 w-8 place-items-center rounded-[10px] border border-[var(--color-border-strong)] bg-[oklch(1_0_0_/_0.04)]">
						<span className="display text-[18px] text-fg leading-none">π</span>
					</span>
					<span className="hidden flex-col leading-tight sm:flex">
						<span className="display text-[15px] text-fg">Pi Telemetry</span>
						<span className="mono text-[9.5px] text-faint uppercase tracking-[0.2em]">
							pi-telemetry-minimal
						</span>
					</span>
				</Link>
				<nav className="flex items-center gap-1">
					<Link
						to="/dashboard"
						className="mono rounded-md px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-fg [&.active]:bg-[oklch(1_0_0_/_0.06)]"
						activeProps={{ className: "active" }}
					>
						Dashboard
					</Link>
					<Link
						to="/settings"
						className="mono rounded-md px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-faint hover:text-dim [&.active]:bg-[oklch(1_0_0_/_0.06)] [&.active]:text-fg"
						activeProps={{ className: "active" }}
					>
						Settings
					</Link>
					<span className="ml-3 inline-flex items-center gap-1.5">
						<span className="inline-block h-1.5 w-1.5 animate-pulse-dot rounded-full bg-[var(--color-positive)]" />
						<span className="mono text-[10px] text-faint uppercase tracking-[0.2em]">
							Live
						</span>
					</span>
				</nav>
			</div>
		</header>
	);
}

/* ───────────────────────── KPI strip ─────────────────────────────── */

function KpiStrip({ data }: { data: DashboardData }) {
	const sums = data.series;
	const series = (key: "turns" | "tokens" | "cost") => sums.map((r) => r[key]);
	const items = [
		{
			label: "Turns",
			value: data.summary.turns,
			previous: data.previous.turns,
			format: formatCount,
			spark: series("turns"),
			color: "var(--color-chart-1)",
		},
		{
			label: "Tokens",
			value: data.summary.tokens,
			previous: data.previous.tokens,
			format: formatCompact,
			spark: series("tokens"),
			color: "var(--color-chart-2)",
		},
		{
			label: "Cost",
			value: data.summary.cost,
			previous: data.previous.cost,
			format: formatCost,
			spark: series("cost"),
			color: "var(--color-chart-3)",
		},
		{
			label: "Developers",
			value: data.summary.developers,
			previous: data.previous.developers,
			format: formatCount,
			spark: [],
			color: "var(--color-chart-4)",
		},
		{
			label: "Projects",
			value: data.summary.projects,
			previous: data.previous.projects,
			format: formatCount,
			spark: [],
			color: "var(--color-chart-6)",
		},
	];
	return (
		<section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
			{items.map((item, i) => (
				<KpiCard key={item.label} {...item} index={i} />
			))}
		</section>
	);
}

function KpiCard({
	label,
	value,
	previous,
	format,
	spark,
	color,
	index,
}: {
	label: string;
	value: number;
	previous: number;
	format: (n: number) => string;
	spark: number[];
	color: string;
	index: number;
}) {
	const animated = useCountUp(value);
	const delta = deltaPercent(value, previous);
	const tone =
		delta === null
			? "default"
			: delta > 1
				? "positive"
				: delta < -1
					? "negative"
					: "default";
	return (
		<Card
			className="animate-rise"
			style={{ animationDelay: `${index * 60}ms` } as React.CSSProperties}
		>
			<CardContent className="px-5 pt-4 pb-4">
				<div className="flex items-start justify-between">
					<p className="mono text-[10.5px] text-faint uppercase tracking-[0.22em]">
						{label}
					</p>
					{delta !== null ? (
						<Chip tone={tone}>
							<TrendArrow positive={delta >= 0} /> {formatPercent(delta)}
						</Chip>
					) : null}
				</div>
				<p className="display mt-3 text-fg text-[28px] leading-none tracking-tight tabular">
					{format(animated)}
				</p>
				<div className="mt-3 flex items-end justify-between gap-2">
					<p className="mono whitespace-nowrap text-[10px] text-faint tracking-[0.12em]">
						prev {format(previous)}
					</p>
					{spark.length ? (
						<Sparkline values={spark} stroke={color} fill={color} width={96} />
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}

function TrendArrow({ positive }: { positive: boolean }) {
	return (
		<svg
			width="9"
			height="9"
			viewBox="0 0 12 12"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<title>trend</title>
			{positive ? <path d="M2 9 L6 5 L10 9" /> : <path d="M2 5 L6 9 L10 5" />}
		</svg>
	);
}

/* ───────────────────────── Filters ───────────────────────────────── */

function FilterBar({
	data,
	search,
	activeChips,
	onClearFilter,
	onApply,
}: {
	data: DashboardData;
	search: DashboardFilters;
	activeChips: Array<[keyof DashboardFilters, string]>;
	onClearFilter: (key: keyof DashboardFilters) => void;
	onApply: (next: DashboardFilters) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	return (
		<Card>
			<CardContent className="px-5 py-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-2">
						<Label>Filters</Label>
						{activeChips.length === 0 ? (
							<span className="mono text-[10.5px] text-faint uppercase tracking-[0.18em]">
								None active
							</span>
						) : (
							activeChips.map(([key, value]) => (
								<Chip
									key={`${key}-${value}`}
									tone="accent"
									onRemove={() => onClearFilter(key)}
								>
									{key}: {value}
								</Chip>
							))
						)}
						{search.from || search.to ? (
							<Chip
								tone="default"
								onRemove={() =>
									onApply({ ...search, from: undefined, to: undefined })
								}
							>
								{search.from ?? "…"} → {search.to ?? "…"}
							</Chip>
						) : null}
					</div>
					<div className="flex items-center gap-2">
						<GhostButton
							type="button"
							onClick={() => setExpanded((v) => !v)}
							aria-expanded={expanded}
						>
							{expanded ? "Hide" : "Refine"}
						</GhostButton>
						{activeChips.length || search.from || search.to ? (
							<GhostButton type="button" onClick={() => onApply({})}>
								Reset
							</GhostButton>
						) : null}
					</div>
				</div>
				{expanded ? (
					<form
						className="mt-4 grid gap-3 border-[var(--color-border)] border-t pt-4 md:grid-cols-4 lg:grid-cols-7"
						onSubmit={(event) => {
							event.preventDefault();
							const form = new FormData(event.currentTarget);
							onApply({
								from: formString(form, "from"),
								to: formString(form, "to"),
								team: formString(form, "team"),
								project: formString(form, "project"),
								developer: formString(form, "developer"),
								model: formString(form, "model"),
								provider: formString(form, "provider"),
							});
						}}
					>
						<Field label="From">
							<Input name="from" type="date" defaultValue={search.from ?? ""} />
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
							<SecondaryButton type="button" onClick={() => onApply({})}>
								Reset
							</SecondaryButton>
						</div>
					</form>
				) : null}
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
		<div className="space-y-1.5">
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

/* ───────────────────────── Events table ──────────────────────────── */

function EventsCard({
	events,
	onSelect,
}: {
	events: DashboardEvent[];
	onSelect: (event: DashboardEvent) => void;
}) {
	return (
		<Card>
			<div className="flex items-end justify-between gap-3 px-6 pt-5 pb-2">
				<div>
					<p className="mono text-[10.5px] text-faint uppercase tracking-[0.22em]">
						Stream
					</p>
					<h2 className="display mt-1 text-[1.05rem] text-fg leading-tight tracking-tight">
						Recent events
					</h2>
					<p className="mt-0.5 text-[12px] text-muted">
						Newest 100 turns. Click a row for the full payload.
					</p>
				</div>
				<span className="mono text-[10.5px] text-faint uppercase tracking-[0.18em]">
					{events.length} shown
				</span>
			</div>
			<div className="overflow-x-auto px-2 pb-4">
				<table className="w-full min-w-[760px] text-left text-sm">
					<thead>
						<tr className="mono text-[10px] text-faint uppercase tracking-[0.18em]">
							{["When", "Who", "Project", "Model", "Tokens", "Cost"].map(
								(h) => (
									<th key={h} className="px-3 py-2 font-normal">
										{h}
									</th>
								),
							)}
						</tr>
					</thead>
					<tbody>
						{events.length === 0 ? (
							<tr>
								<td
									colSpan={6}
									className="px-3 py-10 text-center text-muted text-sm"
								>
									No events yet — once pi-telemetry-minimal posts a turn it will
									land here.
								</td>
							</tr>
						) : (
							events.map((event, i) => (
								<EventRow
									key={event.id}
									event={event}
									striped={i % 2 === 1}
									onSelect={() => onSelect(event)}
								/>
							))
						)}
					</tbody>
				</table>
			</div>
		</Card>
	);
}

function EventRow({
	event,
	striped,
	onSelect,
}: {
	event: DashboardEvent;
	striped: boolean;
	onSelect: () => void;
}) {
	const ts = `${event.timestamp}Z`;
	return (
		<tr
			tabIndex={0}
			onClick={onSelect}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect();
				}
			}}
			className={cn(
				"cursor-pointer border-[var(--color-border)] border-t transition hover:bg-[oklch(1_0_0_/_0.03)] focus-visible:bg-[oklch(1_0_0_/_0.05)]",
				striped && "bg-[oklch(1_0_0_/_0.012)]",
			)}
		>
			<td className="px-3 py-2.5">
				<div className="flex flex-col leading-tight">
					<span className="text-fg text-sm">{formatRelative(ts)}</span>
					<span className="mono text-[10.5px] text-faint">
						{formatAbsolute(ts)}
					</span>
				</div>
			</td>
			<td className="px-3 py-2.5">
				<div className="flex flex-col leading-tight">
					<span className="text-fg text-sm">{event.developer ?? "—"}</span>
					<span className="mono text-[10.5px] text-faint">
						{event.team ?? "no team"}
					</span>
				</div>
			</td>
			<td className="px-3 py-2.5">
				<div className="flex flex-col leading-tight">
					<span className="text-fg text-sm">
						{event.project ?? event.cwdName}
					</span>
					<span
						className="mono truncate text-[10.5px] text-faint"
						title={event.gitBranch ?? ""}
					>
						{event.gitBranch ?? "—"}
					</span>
				</div>
			</td>
			<td className="px-3 py-2.5">
				<div className="flex flex-col leading-tight">
					<span className="mono text-fg text-[12px]">{event.model}</span>
					<span className="mono text-[10.5px] text-faint">
						{event.provider}
					</span>
				</div>
			</td>
			<td className="mono px-3 py-2.5 text-fg text-sm">
				{formatCompact(event.totalTokens)}
			</td>
			<td className="mono px-3 py-2.5 text-fg text-sm">
				{formatCost(event.costTotal ?? 0)}
			</td>
		</tr>
	);
}

/* ───────────────────────── Drawer ────────────────────────────────── */

function EventDrawer({
	event,
	onOpenChange,
}: {
	event: DashboardEvent | null;
	onOpenChange: (open: boolean) => void;
}) {
	const pretty = useMemo(() => {
		if (!event) return "";
		try {
			return JSON.stringify(JSON.parse(event.rawJson), null, 2);
		} catch {
			return event.rawJson;
		}
	}, [event]);
	const ts = event ? `${event.timestamp}Z` : "";

	return (
		<Drawer
			open={Boolean(event)}
			onOpenChange={onOpenChange}
			title={event ? `Turn #${event.turnIndex}` : ""}
			subtitle={event ? `${formatAbsolute(ts)} · ${formatRelative(ts)}` : ""}
		>
			{event ? (
				<div className="space-y-5">
					<div className="grid grid-cols-2 gap-3">
						<DetailStat
							label="Tokens"
							value={formatCompact(event.totalTokens)}
						/>
						<DetailStat label="Cost" value={formatCost(event.costTotal ?? 0)} />
						<DetailStat
							label="Input"
							value={formatCompact(event.inputTokens)}
						/>
						<DetailStat
							label="Output"
							value={formatCompact(event.outputTokens)}
						/>
						<DetailStat
							label="Cache read"
							value={formatCompact(event.cacheReadTokens)}
						/>
						<DetailStat
							label="Cache write"
							value={formatCompact(event.cacheWriteTokens)}
						/>
					</div>

					<DetailGroup label="Model">
						<DetailRow k="Provider" v={event.provider} />
						<DetailRow k="API" v={event.api} />
						<DetailRow k="Model" v={event.model} mono />
					</DetailGroup>

					<DetailGroup label="Context">
						<DetailRow k="Team" v={event.team ?? "—"} />
						<DetailRow k="Project" v={event.project ?? "—"} />
						<DetailRow k="Developer" v={event.developer ?? "—"} />
						<DetailRow k="CWD" v={event.cwd} mono breakAll />
					</DetailGroup>

					<DetailGroup label="Git">
						<DetailRow k="Remote" v={event.gitRemote ?? "—"} mono breakAll />
						<DetailRow k="Branch" v={event.gitBranch ?? "—"} mono />
						<DetailRow k="Commit" v={event.gitCommit ?? "—"} mono />
						<DetailRow k="Author" v={event.gitUserName ?? "—"} />
						<DetailRow k="Email" v={event.gitUserEmail ?? "—"} />
					</DetailGroup>

					<DetailGroup label="Session">
						<DetailRow k="Session ID" v={event.sessionId} mono breakAll copy />
						<DetailRow k="File" v={event.sessionFile ?? "—"} mono breakAll />
					</DetailGroup>

					<details className="group">
						<summary className="mono cursor-pointer list-none text-[10.5px] text-faint uppercase tracking-[0.2em] hover:text-dim">
							<span className="inline-flex items-center gap-1">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="9"
									height="9"
									viewBox="0 0 12 12"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									className="transition group-open:rotate-90"
								>
									<title>toggle</title>
									<path d="m4 2 4 4-4 4" />
								</svg>
								Raw payload
							</span>
						</summary>
						<pre className="mono mt-2 max-h-72 overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[oklch(0_0_0_/_0.3)] p-3 text-[11px] text-dim leading-relaxed">
							{pretty}
						</pre>
					</details>
				</div>
			) : null}
		</Drawer>
	);
}

function DetailStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[oklch(1_0_0_/_0.02)] p-3">
			<p className="mono text-[10px] text-faint uppercase tracking-[0.2em]">
				{label}
			</p>
			<p className="display mt-1 text-fg text-lg leading-none tabular">
				{value}
			</p>
		</div>
	);
}

function DetailGroup({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<p className="mono text-[10px] text-faint uppercase tracking-[0.2em]">
				{label}
			</p>
			<div className="mt-2 space-y-1.5">{children}</div>
		</div>
	);
}

function DetailRow({
	k,
	v,
	mono,
	breakAll,
	copy,
}: {
	k: string;
	v: string;
	mono?: boolean;
	breakAll?: boolean;
	copy?: boolean;
}) {
	return (
		<div className="flex items-start justify-between gap-3 text-sm">
			<span className="text-faint text-[12px]">{k}</span>
			<span
				className={cn(
					"max-w-[68%] text-right text-fg",
					mono && "mono text-[12px]",
					breakAll && "break-all",
				)}
			>
				{v}
				{copy ? (
					<button
						type="button"
						onClick={() => void navigator.clipboard.writeText(v)}
						className="ml-2 align-middle text-faint hover:text-fg"
						aria-label="Copy"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="11"
							height="11"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
						>
							<title>copy</title>
							<rect x="9" y="9" width="13" height="13" rx="2" />
							<path d="M5 15V5a2 2 0 0 1 2-2h10" />
						</svg>
					</button>
				) : null}
			</span>
		</div>
	);
}

/* ───────────────────────── Import ────────────────────────────────── */

function ImportCard({
	busy,
	result,
	onImport,
}: {
	busy: boolean;
	result: string | null;
	onImport: (file: File) => Promise<void> | void;
}) {
	const [hover, setHover] = useState(false);
	return (
		<Card>
			<CardContent className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="mono text-[10.5px] text-faint uppercase tracking-[0.22em]">
						Import
					</p>
					<p className="mt-1 text-dim text-sm">
						Upload an existing pi-telemetry-minimal{" "}
						<span className="mono text-fg">events.jsonl</span>.
					</p>
					{result ? (
						<p className="mt-1.5 text-[12px] text-muted">{result}</p>
					) : null}
				</div>
				<label
					onDragEnter={(e) => {
						e.preventDefault();
						setHover(true);
					}}
					onDragLeave={() => setHover(false)}
					onDragOver={(e) => e.preventDefault()}
					onDrop={(e) => {
						e.preventDefault();
						setHover(false);
						const file = e.dataTransfer.files?.[0];
						if (file) void onImport(file);
					}}
					className={cn(
						"inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] border-dashed bg-[oklch(1_0_0_/_0.02)] px-4 py-2.5 text-sm text-dim transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] hover:text-fg",
						hover &&
							"border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-fg",
					)}
				>
					<Upload size={14} />
					{busy ? "Importing…" : "Drop or choose .jsonl"}
					<input
						type="file"
						accept=".jsonl,.txt,application/json"
						className="hidden"
						disabled={busy}
						onChange={async (event) => {
							const file = event.currentTarget.files?.[0];
							if (file) await onImport(file);
							event.currentTarget.value = "";
						}}
					/>
				</label>
			</CardContent>
		</Card>
	);
}

/* ───────────────────────── Helpers ───────────────────────────────── */

function derivePreset(search: DashboardFilters): PresetValue {
	if (!search.from && !search.to) return "all";
	if (!search.from || !search.to) return "custom";
	const from = Date.parse(`${search.from}T00:00:00`);
	const to = Date.parse(`${search.to}T00:00:00`);
	if (!Number.isFinite(from) || !Number.isFinite(to)) return "custom";
	const days = Math.round((to - from) / 86_400_000) + 1;
	const today = isoDate(new Date());
	if (search.to !== today) return "custom";
	const match = PRESETS.find((p) => p.days === days);
	return match?.value ?? "custom";
}

function isoDate(d: Date) {
	return d.toISOString().slice(0, 10);
}

function formString(form: FormData, key: string) {
	const value = String(form.get(key) ?? "").trim();
	return value || undefined;
}
