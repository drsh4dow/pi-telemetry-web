import { useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	Treemap,
	XAxis,
	YAxis,
} from "recharts";
import type { DashboardData } from "~/lib/dashboard";
import {
	formatCompact,
	formatCost,
	formatCostCompact,
	formatCount,
} from "~/lib/format";
import { cn } from "~/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Segmented } from "./ui/segmented";

const SERIES_COLORS = [
	"var(--color-chart-1)",
	"var(--color-chart-2)",
	"var(--color-chart-3)",
	"var(--color-chart-4)",
	"var(--color-chart-5)",
	"var(--color-chart-6)",
];

type Metric = "tokens" | "turns" | "cost";

const METRICS: Array<{ value: Metric; label: string }> = [
	{ value: "tokens", label: "Tokens" },
	{ value: "turns", label: "Turns" },
	{ value: "cost", label: "Cost" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function DashboardCharts({ data }: { data: DashboardData }) {
	return (
		<div className="grid gap-4 lg:grid-cols-12">
			<TimelineCard data={data} className="lg:col-span-8" />
			<HeatmapCard data={data} className="lg:col-span-4" />
			<TreemapCard data={data} className="lg:col-span-7" />
			<LeaderboardsCard data={data} className="lg:col-span-5" />
		</div>
	);
}

/* ───────────────────────── Timeline ──────────────────────────────── */

function TimelineCard({
	data,
	className,
}: {
	data: DashboardData;
	className?: string;
}) {
	const [metric, setMetric] = useState<Metric>("tokens");
	const models = data.modelSeries.models;
	const rows =
		metric === "tokens"
			? data.modelSeries.dates.map((date, i) => ({
					date,
					...data.modelSeries.values[i],
				}))
			: data.series.map((row) => ({ date: row.date, value: row[metric] }));
	const isStacked = metric === "tokens";

	return (
		<Card className={className}>
			<CardHeader>
				<div>
					<p className="mono text-[10.5px] text-faint uppercase tracking-[0.22em]">
						Activity
					</p>
					<CardTitle className="mt-1">Usage over time</CardTitle>
				</div>
				<Segmented
					value={metric}
					options={METRICS}
					onChange={setMetric}
					ariaLabel="Timeline metric"
				/>
			</CardHeader>
			<CardContent className="h-72 px-2 pb-3">
				<ResponsiveContainer width="100%" height="100%">
					<AreaChart
						data={rows}
						margin={{ left: 8, right: 12, top: 12, bottom: 4 }}
					>
						<defs>
							{(isStacked ? models : ["value"]).map((key, i) => {
								const color = SERIES_COLORS[i % SERIES_COLORS.length];
								return (
									<linearGradient
										key={key}
										id={`grad-${key}`}
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="0%"
											stopColor={color}
											stopOpacity={isStacked ? 0.6 : 0.55}
										/>
										<stop offset="100%" stopColor={color} stopOpacity={0.02} />
									</linearGradient>
								);
							})}
						</defs>
						<CartesianGrid
							strokeDasharray="2 4"
							stroke="var(--color-bg-grid)"
							vertical={false}
						/>
						<XAxis
							dataKey="date"
							tickMargin={10}
							tickLine={false}
							axisLine={false}
							minTickGap={24}
							tickFormatter={shortDate}
						/>
						<YAxis
							tickMargin={8}
							tickLine={false}
							axisLine={false}
							width={48}
							tickFormatter={(v) =>
								metric === "cost" ? formatCostCompact(v) : formatCompact(v)
							}
						/>
						<Tooltip
							content={<TimelineTooltip metric={metric} />}
							cursor={{
								stroke: "var(--color-border-bright)",
								strokeDasharray: "2 4",
							}}
						/>
						{isStacked ? (
							models.map((key, i) => (
								<Area
									key={key}
									type="monotone"
									dataKey={key}
									stackId="t"
									stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
									strokeWidth={1.4}
									fill={`url(#grad-${key})`}
									isAnimationActive
									animationDuration={700}
								/>
							))
						) : (
							<Area
								type="monotone"
								dataKey="value"
								stroke={SERIES_COLORS[0]}
								strokeWidth={1.6}
								fill="url(#grad-value)"
								isAnimationActive
								animationDuration={700}
							/>
						)}
					</AreaChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}

function TimelineTooltip({
	active,
	payload,
	label,
	metric,
}: {
	active?: boolean;
	payload?: Array<{
		name: string;
		value: number;
		color: string;
		dataKey: string;
	}>;
	label?: string;
	metric: Metric;
}) {
	if (!active || !payload?.length) return null;
	const total = payload.reduce((acc, p) => acc + (p.value ?? 0), 0);
	const sorted = [...payload]
		.filter((p) => p.value)
		.sort((a, b) => b.value - a.value);
	return (
		<div className="glass-strong mono min-w-[180px] rounded-[var(--radius-md)] px-3 py-2 text-[11px]">
			<p className="text-faint uppercase tracking-[0.18em]">
				{shortDate(label ?? "")}
			</p>
			<div className="mt-1.5 space-y-1">
				{sorted.map((p) => (
					<div
						key={p.dataKey}
						className="flex items-center justify-between gap-3"
					>
						<span className="flex items-center gap-1.5 text-dim">
							<span
								className="inline-block h-2 w-2 rounded-full"
								style={{ background: p.color }}
							/>
							{p.dataKey === "value" ? metric : p.dataKey}
						</span>
						<span className="text-fg">{formatMetric(p.value, metric)}</span>
					</div>
				))}
			</div>
			{sorted.length > 1 ? (
				<div className="mt-1.5 flex items-center justify-between border-t border-[var(--color-border)] pt-1.5 text-faint">
					<span>Total</span>
					<span className="text-fg">{formatMetric(total, metric)}</span>
				</div>
			) : null}
		</div>
	);
}

function formatMetric(value: number, metric: Metric) {
	if (metric === "cost") return formatCost(value);
	if (metric === "tokens") return formatCompact(value);
	return formatCount(value);
}

function shortDate(value: string) {
	if (!value) return "";
	const hourly = value.includes(":");
	const d = new Date(
		hourly ? `${value.replace(" ", "T")}:00Z` : `${value}T00:00:00Z`,
	);
	if (Number.isNaN(d.getTime())) return value;
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		...(hourly ? { hour: "2-digit", minute: "2-digit" } : {}),
	}).format(d);
}

/* ───────────────────────── Heatmap ───────────────────────────────── */

function HeatmapCard({
	data,
	className,
}: {
	data: DashboardData;
	className?: string;
}) {
	const { cells, max } = data.heatmap;
	const empty = max === 0;
	return (
		<Card className={className}>
			<CardHeader>
				<div>
					<p className="mono text-[10.5px] text-faint uppercase tracking-[0.22em]">
						Cadence
					</p>
					<CardTitle className="mt-1">Day × hour</CardTitle>
				</div>
				<HeatmapLegend />
			</CardHeader>
			<CardContent className="pb-5">
				<div className="-mx-1 overflow-x-auto px-1">
					<div className="min-w-[300px]">
						<div
							className="grid gap-[3px]"
							style={{ gridTemplateColumns: "auto repeat(24, minmax(0, 1fr))" }}
						>
							<div />
							{HOURS.map((h) => (
								<div
									key={`hour-${h}`}
									className={cn(
										"mono text-center text-[9px] text-faint",
										h % 3 !== 0 && "opacity-0",
									)}
								>
									{String(h).padStart(2, "0")}
								</div>
							))}
							{cells.map((row, day) => (
								<HeatmapRow
									key={WEEKDAYS[day]}
									day={day}
									row={row}
									max={max}
									empty={empty}
								/>
							))}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function HeatmapRow({
	day,
	row,
	max,
	empty,
}: {
	day: number;
	row: number[];
	max: number;
	empty: boolean;
}) {
	return (
		<>
			<div className="mono pr-2 text-right text-[9.5px] text-faint">
				{WEEKDAYS[day]}
			</div>
			{row.map((value, hour) => {
				const cellKey = `${day}-${hour}`;
				const intensity = empty ? 0 : Math.sqrt(value / max);
				const bg =
					value === 0
						? "oklch(1 0 0 / 0.025)"
						: `color-mix(in oklch, var(--color-accent) ${Math.round(intensity * 88 + 8)}%, transparent)`;
				return (
					<div
						key={cellKey}
						title={`${WEEKDAYS[day]} ${String(hour).padStart(2, "0")}:00 · ${formatCompact(value)} tokens`}
						className="aspect-square rounded-[3px] transition hover:ring-1 hover:ring-[var(--color-border-bright)]"
						style={{ background: bg }}
					/>
				);
			})}
		</>
	);
}

function HeatmapLegend() {
	const stops = [0.08, 0.3, 0.55, 0.8, 1];
	return (
		<div className="mono flex items-center gap-1.5 text-[9.5px] text-faint">
			<span>less</span>
			{stops.map((s) => (
				<span
					key={s}
					className="inline-block h-2.5 w-2.5 rounded-[2px]"
					style={{
						background: `color-mix(in oklch, var(--color-accent) ${Math.round(s * 88 + 8)}%, transparent)`,
					}}
				/>
			))}
			<span>more</span>
		</div>
	);
}

/* ───────────────────────── Treemap ───────────────────────────────── */

function TreemapCard({
	data,
	className,
}: {
	data: DashboardData;
	className?: string;
}) {
	const maxCost = data.byProject.reduce((m, p) => Math.max(m, p.cost), 0);
	const tree = data.byProject
		.filter((p) => p.tokens > 0)
		.map((p) => ({
			name: p.name,
			size: Math.max(p.tokens, 1),
			tokens: p.tokens,
			cost: p.cost,
			turns: p.turns,
			intensity: maxCost > 0 ? p.cost / maxCost : 0,
		}));
	return (
		<Card className={className}>
			<CardHeader>
				<div>
					<p className="mono text-[10.5px] text-faint uppercase tracking-[0.22em]">
						Footprint
					</p>
					<CardTitle className="mt-1">Projects</CardTitle>
					<p className="mt-1 text-[11px] text-muted">
						Sized by tokens, shaded by cost intensity.
					</p>
				</div>
			</CardHeader>
			<CardContent className="h-72 pb-5">
				{tree.length === 0 ? (
					<EmptyState message="No project data in window." />
				) : (
					<ResponsiveContainer width="100%" height="100%">
						<Treemap
							data={tree}
							dataKey="size"
							stroke="var(--color-bg)"
							isAnimationActive
							animationDuration={500}
							content={<TreemapTile />}
						>
							<Tooltip content={<TreemapTooltip />} />
						</Treemap>
					</ResponsiveContainer>
				)}
			</CardContent>
		</Card>
	);
}

interface TreemapTileProps {
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	name?: string;
	intensity?: number;
	tokens?: number;
}

function TreemapTile(props: TreemapTileProps) {
	const {
		x = 0,
		y = 0,
		width = 0,
		height = 0,
		name = "",
		intensity = 0,
		tokens = 0,
	} = props;
	if (width <= 0 || height <= 0) return null;
	const fill = `color-mix(in oklch, var(--color-accent) ${Math.round(intensity * 80 + 12)}%, oklch(0.3 0.02 260))`;
	const showLabel = width > 70 && height > 36;
	const showValue = width > 90 && height > 56;
	return (
		<g>
			<rect
				x={x}
				y={y}
				width={width}
				height={height}
				fill={fill}
				stroke="var(--color-bg)"
				strokeWidth={1}
				rx={6}
			/>
			{showLabel ? (
				<text
					x={x + 10}
					y={y + 18}
					fill="var(--color-fg)"
					fontFamily="var(--font-sans)"
					fontWeight={500}
					fontSize={12}
				>
					{truncate(name, Math.max(6, Math.floor(width / 8)))}
				</text>
			) : null}
			{showValue ? (
				<text
					x={x + 10}
					y={y + 34}
					fill="var(--color-fg-muted)"
					fontFamily="var(--font-mono)"
					fontSize={10.5}
				>
					{formatCompact(tokens)}
				</text>
			) : null}
		</g>
	);
}

function TreemapTooltip({
	active,
	payload,
}: {
	active?: boolean;
	payload?: Array<{
		payload: { name: string; tokens: number; cost: number; turns: number };
	}>;
}) {
	if (!active || !payload?.length) return null;
	const p = payload[0]?.payload;
	if (!p) return null;
	return (
		<div className="glass-strong mono min-w-[180px] rounded-[var(--radius-md)] px-3 py-2 text-[11px]">
			<p className="text-fg text-[12px]">{p.name}</p>
			<div className="mt-1 space-y-0.5 text-faint">
				<Row label="Tokens" value={formatCompact(p.tokens)} />
				<Row label="Cost" value={formatCost(p.cost)} />
				<Row label="Turns" value={formatCount(p.turns)} />
			</div>
		</div>
	);
}

function Row({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-3">
			<span>{label}</span>
			<span className="text-fg">{value}</span>
		</div>
	);
}

function truncate(s: string, n: number) {
	return s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s;
}

/* ───────────────────────── Leaderboards ──────────────────────────── */

function LeaderboardsCard({
	data,
	className,
}: {
	data: DashboardData;
	className?: string;
}) {
	const groups: Array<{
		key: string;
		title: string;
		rows: typeof data.byModel;
	}> = [
		{ key: "models", title: "Models", rows: data.byModel },
		{ key: "developers", title: "Developers", rows: data.byDeveloper },
	];
	const [active, setActive] = useState<string>("models");
	const current = groups.find((g) => g.key === active) ?? groups[0];
	const max = current.rows.reduce((m, r) => Math.max(m, r.tokens), 0);

	return (
		<Card className={className}>
			<CardHeader>
				<div>
					<p className="mono text-[10.5px] text-faint uppercase tracking-[0.22em]">
						Leaderboard
					</p>
					<CardTitle className="mt-1">Top by tokens</CardTitle>
				</div>
				<Segmented
					value={active}
					options={groups.map((g) => ({ value: g.key, label: g.title }))}
					onChange={setActive}
				/>
			</CardHeader>
			<CardContent className="pb-5">
				{current.rows.length === 0 ? (
					<EmptyState message="No data in window." />
				) : (
					<ol className="space-y-1.5">
						{current.rows.map((row, i) => {
							const pct = max > 0 ? (row.tokens / max) * 100 : 0;
							return (
								<li
									key={`${current.key}-${row.name}`}
									className="group relative grid grid-cols-[20px_1fr_auto] items-center gap-3 overflow-hidden rounded-[8px] px-2 py-1.5"
								>
									<span
										className="absolute inset-y-0 left-0 -z-0 rounded-[8px] bg-[var(--color-accent-soft)] opacity-50 transition group-hover:opacity-80"
										style={{ width: `${pct}%` }}
									/>
									<span className="mono z-1 text-[10.5px] text-faint">
										{String(i + 1).padStart(2, "0")}
									</span>
									<span className="z-1 truncate text-sm text-fg">
										{row.name}
									</span>
									<span className="z-1 flex items-baseline gap-2">
										<span className="mono text-fg text-sm">
											{formatCompact(row.tokens)}
										</span>
										<span className="mono text-[10px] text-faint">
											{formatCostCompact(row.cost)}
										</span>
									</span>
								</li>
							);
						})}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}

function EmptyState({ message }: { message: string }) {
	return (
		<div className="flex h-full min-h-32 items-center justify-center text-center">
			<p className="mono text-[11px] text-faint uppercase tracking-[0.18em]">
				{message}
			</p>
		</div>
	);
}
