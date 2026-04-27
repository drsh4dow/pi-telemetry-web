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
import { Badge } from "~/components/ui/badge";
import { Button, GhostButton, SecondaryButton } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Drawer } from "~/components/ui/dialog";
import { Input, Label, Select } from "~/components/ui/form";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { Tabs } from "~/components/ui/tabs";
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
	{ value: "24h", label: "24h", days: 1 },
	{ value: "7d", label: "7d", days: 7 },
	{ value: "30d", label: "30d", days: 30 },
	{ value: "90d", label: "90d", days: 90 },
	{ value: "all", label: "All", days: 0 },
] as const;
type PresetValue = (typeof PRESETS)[number]["value"] | "custom";

const FILTER_KEYS = [
	"team",
	"project",
	"developer",
	"model",
	"provider",
] as const;
const PAGE_SIZE = 10;

function DashboardPage() {
	const data = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: "/dashboard" });
	const router = useRouter();
	const [importResult, setImportResult] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [drawerEvent, setDrawerEvent] = useState<DashboardEvent | null>(null);
	const [page, setPage] = useState(0);

	const activePreset = derivePreset(search);
	const activeFilters = FILTER_KEYS.flatMap((key) => {
		const value = search[key];
		return value ? [{ key, value }] : [];
	});

	useEffect(() => {
		const id = window.setInterval(() => {
			if (document.visibilityState === "visible") {
				void router.invalidate();
			}
		}, 30_000);
		return () => window.clearInterval(id);
	}, [router]);

	function applyPreset(value: PresetValue) {
		if (value === "custom") return;
		if (value === "all") {
			void navigate({ search: { ...stripDates(search) } });
			return;
		}
		const days = PRESETS.find((p) => p.value === value)?.days ?? 7;
		const to = isoDate(new Date());
		const from = isoDate(new Date(Date.now() - (days - 1) * 86_400_000));
		void navigate({ search: { ...search, from, to } });
	}

	const totalPages = Math.max(1, Math.ceil(data.events.length / PAGE_SIZE));
	const currentPage = Math.min(page, totalPages - 1);
	const pagedEvents = data.events.slice(
		currentPage * PAGE_SIZE,
		(currentPage + 1) * PAGE_SIZE,
	);

	return (
		<div className="min-h-screen bg-background">
			<TopBar />
			<main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				<header className="flex flex-wrap items-end justify-between gap-3">
					<div>
						<h1 className="font-semibold text-2xl tracking-tight">Dashboard</h1>
						<p className="mt-1 text-muted-foreground text-sm">
							Pi consumption across teams, projects, and models.
						</p>
					</div>
					<Tabs
						value={activePreset === "custom" ? "all" : activePreset}
						options={PRESETS.map((p) => ({ value: p.value, label: p.label }))}
						onChange={(v) => applyPreset(v as PresetValue)}
						ariaLabel="Time range"
					/>
				</header>

				<KpiGrid data={data} />

				<FilterBar
					data={data}
					search={search}
					activeFilters={activeFilters}
					onChange={(next) => navigate({ search: next })}
				/>

				<DashboardCharts data={data} />

				<Card>
					<CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
						<div className="space-y-1.5">
							<CardTitle>Recent events</CardTitle>
							<CardDescription>
								{data.events.length} latest turn
								{data.events.length === 1 ? "" : "s"}. Click a row for the full
								payload.
							</CardDescription>
						</div>
					</CardHeader>
					<CardContent className="px-0">
						<Table>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead className="pl-6">When</TableHead>
									<TableHead>Developer</TableHead>
									<TableHead>Project</TableHead>
									<TableHead>Model</TableHead>
									<TableHead className="text-right">Tokens</TableHead>
									<TableHead className="pr-6 text-right">Cost</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{pagedEvents.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={6}
											className="h-24 text-center text-muted-foreground"
										>
											No events yet. Once pi-telemetry-minimal posts a turn it
											will land here.
										</TableCell>
									</TableRow>
								) : (
									pagedEvents.map((event) => (
										<EventRow
											key={event.id}
											event={event}
											onSelect={() => setDrawerEvent(event)}
										/>
									))
								)}
							</TableBody>
						</Table>
					</CardContent>
					{data.events.length > PAGE_SIZE ? (
						<div className="flex items-center justify-between border-border border-t px-6 py-3 text-sm">
							<p className="text-muted-foreground text-xs">
								Page {currentPage + 1} of {totalPages} · showing{" "}
								{currentPage * PAGE_SIZE + 1}–
								{Math.min((currentPage + 1) * PAGE_SIZE, data.events.length)} of{" "}
								{data.events.length}
							</p>
							<div className="flex gap-2">
								<SecondaryButton
									type="button"
									size="sm"
									disabled={currentPage === 0}
									onClick={() => setPage((p) => Math.max(0, p - 1))}
								>
									Previous
								</SecondaryButton>
								<SecondaryButton
									type="button"
									size="sm"
									disabled={currentPage >= totalPages - 1}
									onClick={() =>
										setPage((p) => Math.min(totalPages - 1, p + 1))
									}
								>
									Next
								</SecondaryButton>
							</div>
						</div>
					) : null}
				</Card>

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
		<header className="sticky top-0 z-30 border-border border-b bg-background/80 backdrop-blur">
			<div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
				<Link to="/dashboard" className="flex items-center gap-2.5">
					<span className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background">
						<span className="font-semibold text-sm leading-none">π</span>
					</span>
					<span className="font-semibold text-sm">Pi Telemetry</span>
				</Link>
				<nav className="flex items-center gap-1">
					<Link
						to="/dashboard"
						className="rounded-md px-3 py-1.5 font-medium text-sm text-muted-foreground transition-colors hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
						activeProps={{ className: "active" }}
					>
						Dashboard
					</Link>
					<Link
						to="/settings"
						className="rounded-md px-3 py-1.5 font-medium text-sm text-muted-foreground transition-colors hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
						activeProps={{ className: "active" }}
					>
						Settings
					</Link>
					<span className="ml-3 hidden items-center gap-1.5 sm:inline-flex">
						<span className="inline-block h-1.5 w-1.5 animate-pulse-dot rounded-full bg-emerald-500" />
						<span className="text-muted-foreground text-xs">Live</span>
					</span>
				</nav>
			</div>
		</header>
	);
}

/* ───────────────────────── KPIs ──────────────────────────────────── */

function KpiGrid({ data }: { data: DashboardData }) {
	const items = [
		{
			label: "Turns",
			value: data.summary.turns,
			previous: data.previous.turns,
			format: formatCount,
		},
		{
			label: "Tokens",
			value: data.summary.tokens,
			previous: data.previous.tokens,
			format: formatCompact,
		},
		{
			label: "Cost",
			value: data.summary.cost,
			previous: data.previous.cost,
			format: formatCost,
		},
		{
			label: "Developers",
			value: data.summary.developers,
			previous: data.previous.developers,
			format: formatCount,
		},
		{
			label: "Projects",
			value: data.summary.projects,
			previous: data.previous.projects,
			format: formatCount,
		},
	];
	return (
		<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
			{items.map((item) => (
				<KpiCard key={item.label} {...item} />
			))}
		</section>
	);
}

function KpiCard({
	label,
	value,
	previous,
	format,
}: {
	label: string;
	value: number;
	previous: number;
	format: (n: number) => string;
}) {
	const delta = deltaPercent(value, previous);
	const variant =
		delta === null
			? "muted"
			: delta > 1
				? "positive"
				: delta < -1
					? "negative"
					: "muted";
	return (
		<Card>
			<CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
				<CardDescription className="text-sm">{label}</CardDescription>
				{delta !== null ? (
					<Badge variant={variant}>
						<TrendArrow positive={delta >= 0} /> {formatPercent(delta)}
					</Badge>
				) : null}
			</CardHeader>
			<CardContent>
				<p className="font-semibold text-2xl tabular tracking-tight">
					{format(value)}
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					vs {format(previous)} previous period
				</p>
			</CardContent>
		</Card>
	);
}

function TrendArrow({ positive }: { positive: boolean }) {
	return (
		<svg
			width="10"
			height="10"
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
	activeFilters,
	onChange,
}: {
	data: DashboardData;
	search: DashboardFilters;
	activeFilters: Array<{ key: keyof DashboardFilters; value: string }>;
	onChange: (next: DashboardFilters) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const hasAny = activeFilters.length > 0 || search.from || search.to;
	return (
		<Card>
			<CardContent className="px-4 py-3 sm:px-6">
				<div className="flex flex-wrap items-center gap-2">
					<div className="flex flex-1 flex-wrap items-center gap-2">
						{!hasAny ? (
							<span className="text-muted-foreground text-sm">
								No filters applied
							</span>
						) : (
							<>
								{search.from || search.to ? (
									<Badge variant="secondary" className="gap-1.5">
										{search.from ?? "…"} → {search.to ?? "…"}
										<button
											type="button"
											aria-label="Clear date range"
											onClick={() => onChange(stripDates(search))}
											className="ml-0.5 rounded-sm text-muted-foreground hover:text-foreground"
										>
											<X />
										</button>
									</Badge>
								) : null}
								{activeFilters.map(({ key, value }) => (
									<Badge
										key={`${key}-${value}`}
										variant="secondary"
										className="gap-1.5"
									>
										<span className="text-muted-foreground capitalize">
											{key}:
										</span>
										<span>{value}</span>
										<button
											type="button"
											aria-label={`Clear ${key}`}
											onClick={() => onChange({ ...search, [key]: undefined })}
											className="ml-0.5 rounded-sm text-muted-foreground hover:text-foreground"
										>
											<X />
										</button>
									</Badge>
								))}
							</>
						)}
					</div>
					<div className="flex items-center gap-2">
						{hasAny ? (
							<GhostButton type="button" size="sm" onClick={() => onChange({})}>
								Reset
							</GhostButton>
						) : null}
						<SecondaryButton
							type="button"
							size="sm"
							onClick={() => setExpanded((v) => !v)}
							aria-expanded={expanded}
						>
							{expanded ? "Hide filters" : "Add filters"}
						</SecondaryButton>
					</div>
				</div>
				{expanded ? (
					<form
						className="mt-4 grid gap-4 border-border border-t pt-4 md:grid-cols-4 lg:grid-cols-7"
						onSubmit={(event) => {
							event.preventDefault();
							const form = new FormData(event.currentTarget);
							onChange({
								from: formString(form, "from"),
								to: formString(form, "to"),
								team: formString(form, "team"),
								project: formString(form, "project"),
								developer: formString(form, "developer"),
								model: formString(form, "model"),
								provider: formString(form, "provider"),
							});
							setExpanded(false);
						}}
					>
						<Field name="from" label="From">
							<Input name="from" type="date" defaultValue={search.from ?? ""} />
						</Field>
						<Field name="to" label="To">
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
							<SecondaryButton type="button" onClick={() => onChange({})}>
								Reset
							</SecondaryButton>
						</div>
					</form>
				) : null}
			</CardContent>
		</Card>
	);
}

function X() {
	return (
		<svg
			width="10"
			height="10"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.4"
			strokeLinecap="round"
			aria-hidden
		>
			<title>remove</title>
			<path d="M18 6 6 18M6 6l12 12" />
		</svg>
	);
}

function Field({
	name,
	label,
	children,
}: {
	name: string;
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={`f-${name}`}>{label}</Label>
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
		<Field name={props.name} label={props.label}>
			<Select
				id={`f-${props.name}`}
				name={props.name}
				defaultValue={props.value ?? ""}
			>
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

/* ───────────────────────── Events ────────────────────────────────── */

function EventRow({
	event,
	onSelect,
}: {
	event: DashboardEvent;
	onSelect: () => void;
}) {
	const ts = `${event.timestamp}Z`;
	return (
		<TableRow
			tabIndex={0}
			onClick={onSelect}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect();
				}
			}}
			className="cursor-pointer"
		>
			<TableCell className="pl-6">
				<div className="flex flex-col">
					<span className="text-foreground text-sm">{formatRelative(ts)}</span>
					<span className="text-[11px] text-muted-foreground">
						{formatAbsolute(ts)}
					</span>
				</div>
			</TableCell>
			<TableCell>
				<div className="flex flex-col">
					<span className="text-foreground text-sm">
						{event.developer ?? "—"}
					</span>
					{event.team ? (
						<span className="text-[11px] text-muted-foreground">
							{event.team}
						</span>
					) : null}
				</div>
			</TableCell>
			<TableCell>
				<div className="flex flex-col">
					<span className="text-foreground text-sm">
						{event.project ?? event.cwdName}
					</span>
					{event.gitBranch ? (
						<span className="text-[11px] text-muted-foreground">
							{event.gitBranch}
						</span>
					) : null}
				</div>
			</TableCell>
			<TableCell>
				<div className="flex flex-col">
					<span className="text-foreground text-sm">{event.model}</span>
					<span className="text-[11px] text-muted-foreground">
						{event.provider}
					</span>
				</div>
			</TableCell>
			<TableCell className="text-right text-sm tabular">
				{formatCompact(event.totalTokens)}
			</TableCell>
			<TableCell className="pr-6 text-right text-sm tabular">
				{formatCost(event.costTotal ?? 0)}
			</TableCell>
		</TableRow>
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
				<div className="space-y-6">
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
						<summary className="cursor-pointer list-none font-medium text-muted-foreground text-xs hover:text-foreground">
							<span className="inline-flex items-center gap-1.5">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="10"
									height="10"
									viewBox="0 0 12 12"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									className="transition-transform group-open:rotate-90"
								>
									<title>toggle</title>
									<path d="m4 2 4 4-4 4" />
								</svg>
								Raw payload
							</span>
						</summary>
						<pre className="mt-2 max-h-72 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] text-foreground leading-relaxed">
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
		<div className="rounded-md border border-border bg-muted/30 p-3">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="mt-1 font-semibold text-base tabular">{value}</p>
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
			<h3 className="font-medium text-sm">{label}</h3>
			<div className="mt-2 space-y-2">{children}</div>
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
			<span className="text-muted-foreground text-xs">{k}</span>
			<span
				className={cn(
					"max-w-[68%] text-right text-foreground",
					mono && "font-mono text-xs",
					breakAll && "break-all",
				)}
			>
				{v}
				{copy ? (
					<button
						type="button"
						onClick={() => void navigator.clipboard.writeText(v)}
						className="ml-2 align-middle text-muted-foreground hover:text-foreground"
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
			<CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
				<div className="space-y-1.5">
					<CardTitle>Import JSONL</CardTitle>
					<CardDescription>
						Upload an existing pi-telemetry-minimal{" "}
						<code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
							events.jsonl
						</code>
						.
					</CardDescription>
				</div>
			</CardHeader>
			<CardContent>
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
						"flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border border-dashed bg-muted/30 px-4 py-6 text-muted-foreground text-sm transition-colors hover:bg-muted/60 hover:text-foreground",
						hover && "border-ring bg-muted/60 text-foreground",
					)}
				>
					<Upload size={16} />
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
				{result ? (
					<p className="mt-3 text-muted-foreground text-xs">{result}</p>
				) : null}
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

function stripDates(search: DashboardFilters): DashboardFilters {
	const { from: _f, to: _t, ...rest } = search;
	return rest;
}

function formString(form: FormData, key: string) {
	const value = String(form.get(key) ?? "").trim();
	return value || undefined;
}
