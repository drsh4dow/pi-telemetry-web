import { type ReactNode, useId, useState } from "react";
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
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Tabs } from "~/components/ui/tabs";
import type { DashboardData, DashboardGroup } from "~/lib/dashboard";
import {
	formatCompact,
	formatCost,
	formatCostCompact,
	formatCount,
} from "~/lib/format";
import { cn } from "~/lib/utils";

const SERIES_COLORS = [
	"var(--color-chart-1)",
	"var(--color-chart-2)",
	"var(--color-chart-3)",
	"var(--color-chart-4)",
	"var(--color-chart-5)",
];

type Metric = "tokens" | "turns" | "cost";

const METRICS: Array<{ value: Metric; label: string }> = [
	{ value: "tokens", label: "Tokens" },
	{ value: "turns", label: "Turns" },
	{ value: "cost", label: "Cost" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const CHART_INITIAL_DIMENSION = { width: 320, height: 288 };

function ChartViewport({ children }: { children: ReactNode }) {
	return (
		<ResponsiveContainer
			width="100%"
			height="100%"
			minWidth={0}
			initialDimension={CHART_INITIAL_DIMENSION}
		>
			{children}
		</ResponsiveContainer>
	);
}

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
	const gradientPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
	const models = data.modelSeries.models;
	const rows =
		metric === "tokens"
			? data.modelSeries.dates.map((date, i) => ({
					date,
					...data.modelSeries.values[i],
				}))
			: data.series.map((row) => ({ date: row.date, value: row[metric] }));
	const isStacked = metric === "tokens";
	const seriesKeys = isStacked ? models : ["value"];
	const gradientId = (key: string) =>
		`${gradientPrefix}-${seriesKeys.indexOf(key)}`;

	return (
		<Card className={className}>
			<CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
				<div className="space-y-1.5">
					<CardTitle>Usage over time</CardTitle>
					<CardDescription>
						{metric === "tokens"
							? "Tokens consumed by top models."
							: metric === "turns"
								? "Turns recorded across the window."
								: "Spend across the window."}
					</CardDescription>
				</div>
				<Tabs value={metric} options={METRICS} onChange={setMetric} />
			</CardHeader>
			<CardContent className="h-72 min-w-0 px-2 pb-4">
				{rows.length === 0 ? (
					<EmptyState message="No activity in the selected window." />
				) : (
					<ChartViewport>
						<AreaChart
							data={rows}
							margin={{ left: 8, right: 16, top: 8, bottom: 0 }}
						>
							<defs>
								{seriesKeys.map((key, i) => {
									const color = SERIES_COLORS[i % SERIES_COLORS.length];
									return (
										<linearGradient
											key={key}
											id={gradientId(key)}
											x1="0"
											y1="0"
											x2="0"
											y2="1"
										>
											<stop offset="0%" stopColor={color} stopOpacity={0.4} />
											<stop offset="100%" stopColor={color} stopOpacity={0} />
										</linearGradient>
									);
								})}
							</defs>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke="var(--color-border)"
								vertical={false}
							/>
							<XAxis
								dataKey="date"
								tickMargin={10}
								tickLine={false}
								axisLine={false}
								minTickGap={32}
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
									stroke: "var(--color-border)",
									strokeDasharray: "3 3",
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
										strokeWidth={1.6}
										fill={`url(#${gradientId(key)})`}
										isAnimationActive
										animationDuration={500}
									/>
								))
							) : (
								<Area
									type="monotone"
									dataKey="value"
									stroke={SERIES_COLORS[0]}
									strokeWidth={1.8}
									fill={`url(#${gradientId("value")})`}
									isAnimationActive
									animationDuration={500}
								/>
							)}
						</AreaChart>
					</ChartViewport>
				)}
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
	const sorted = [...payload]
		.filter((p) => p.value)
		.sort((a, b) => b.value - a.value);
	const total = sorted.reduce((acc, p) => acc + p.value, 0);
	return (
		<div className="rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
			<p className="font-medium text-xs">{shortDate(label ?? "")}</p>
			<div className="mt-1.5 space-y-1">
				{sorted.map((p) => (
					<div
						key={p.dataKey}
						className="flex items-center justify-between gap-4 text-xs"
					>
						<span className="flex items-center gap-2 text-muted-foreground">
							<span
								className="inline-block h-2 w-2 rounded-[2px]"
								style={{ background: p.color }}
							/>
							{p.dataKey === "value" ? metric : p.dataKey}
						</span>
						<span className="tabular text-foreground">
							{formatMetric(p.value, metric)}
						</span>
					</div>
				))}
			</div>
			{sorted.length > 1 ? (
				<div className="mt-1.5 flex items-center justify-between border-border border-t pt-1.5 text-xs">
					<span className="text-muted-foreground">Total</span>
					<span className="tabular font-medium text-foreground">
						{formatMetric(total, metric)}
					</span>
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
				<CardTitle>Activity by hour</CardTitle>
				<CardDescription>Tokens consumed by weekday and hour.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="-mx-1 overflow-x-auto px-1">
					<div className="min-w-[300px]">
						<div
							className="grid gap-[3px]"
							style={{
								gridTemplateColumns: "auto repeat(24, minmax(0, 1fr))",
							}}
						>
							<div />
							{HOURS.map((h) => (
								<div
									key={`hour-${h}`}
									className={cn(
										"text-center text-[9px] text-muted-foreground tabular",
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
				<div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
					<span>Less</span>
					{[0.08, 0.3, 0.55, 0.8, 1].map((s) => (
						<span
							key={s}
							className="inline-block h-2.5 w-2.5 rounded-[2px]"
							style={{
								background: `color-mix(in oklch, var(--color-chart-1) ${Math.round(s * 88 + 8)}%, transparent)`,
							}}
						/>
					))}
					<span>More</span>
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
			<div className="pr-2 text-right text-[10px] text-muted-foreground">
				{WEEKDAYS[day]}
			</div>
			{row.map((value, hour) => {
				const cellKey = `${day}-${hour}`;
				const intensity = empty ? 0 : Math.sqrt(value / max);
				const bg =
					value === 0
						? "color-mix(in oklch, var(--color-muted) 60%, transparent)"
						: `color-mix(in oklch, var(--color-chart-1) ${Math.round(intensity * 88 + 8)}%, transparent)`;
				return (
					<div
						key={cellKey}
						title={`${WEEKDAYS[day]} ${String(hour).padStart(2, "0")}:00 · ${formatCompact(value)} tokens`}
						className="aspect-square rounded-[3px] transition-shadow hover:ring-1 hover:ring-border"
						style={{ background: bg }}
					/>
				);
			})}
		</>
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
			...p,
			size: Math.max(p.tokens, 1),
			intensity: maxCost > 0 ? p.cost / maxCost : 0,
		}));
	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>Projects</CardTitle>
				<CardDescription>
					Tile size by tokens, color by cost intensity.
				</CardDescription>
			</CardHeader>
			<CardContent className="h-72 min-w-0">
				{tree.length === 0 ? (
					<EmptyState message="No project data in window." />
				) : (
					<ChartViewport>
						<Treemap
							data={tree}
							dataKey="size"
							stroke="var(--color-card)"
							isAnimationActive
							animationDuration={400}
							content={<TreemapTile />}
						>
							<Tooltip content={<TreemapTooltip />} />
						</Treemap>
					</ChartViewport>
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
	if (!name || width <= 0 || height <= 0) return null;
	const fill = `color-mix(in oklch, var(--color-chart-1) ${Math.round(intensity * 56 + 22)}%, var(--color-secondary))`;
	const showLabel = width > 70 && height > 32;
	const showValue = width > 90 && height > 50;
	const labelWidth = Math.max(0, width - 12);
	return (
		<g>
			<rect
				x={x}
				y={y}
				width={width}
				height={height}
				fill={fill}
				stroke="var(--color-card)"
				strokeWidth={2}
				rx={6}
			/>
			{showLabel ? (
				<>
					<rect
						x={x + 6}
						y={y + 7}
						width={labelWidth}
						height={showValue ? 34 : 20}
						fill="rgba(0, 0, 0, 0.28)"
						rx={5}
					/>
					<text
						x={x + 12}
						y={y + 21}
						fill="rgba(255, 255, 255, 0.96)"
						fontFamily="var(--font-sans)"
						fontWeight={650}
						fontSize={12}
					>
						{truncate(name, Math.max(6, Math.floor(width / 8)))}
					</text>
				</>
			) : null}
			{showValue ? (
				<text
					x={x + 12}
					y={y + 36}
					fill="rgba(255, 255, 255, 0.72)"
					fontFamily="var(--font-sans)"
					fontSize={11}
					style={{ fontVariantNumeric: "tabular-nums" }}
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
		payload: DashboardGroup;
	}>;
}) {
	if (!active || !payload?.length) return null;
	const p = payload[0]?.payload;
	if (!p) return null;
	return (
		<div className="rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
			<p className="font-medium text-sm">{p.name}</p>
			<div className="mt-1 space-y-0.5 text-xs">
				<TooltipRow label="Tokens" value={formatCompact(p.tokens)} />
				<TooltipRow label="Cost" value={formatCost(p.cost)} />
				<TooltipRow
					label="Effective rate"
					value={`${formatCost(p.costPerMillionTokens)}/1M`}
				/>
				<TooltipRow label="Cache reads" value={formatCacheShare(p)} />
				<TooltipRow label="Turns" value={formatCount(p.turns)} />
			</div>
		</div>
	);
}

function TooltipRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-4">
			<span className="text-muted-foreground">{label}</span>
			<span className="tabular text-foreground">{value}</span>
		</div>
	);
}

function formatCacheShare(row: DashboardGroup): string {
	return `${Math.round(row.cacheReadPercent)}% cached`;
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
	const groups = [
		{ key: "models" as const, title: "Models", rows: data.byModel },
		{ key: "developers" as const, title: "Developers", rows: data.byDeveloper },
	];
	const [active, setActive] = useState<string>("models");
	const current = groups.find((g) => g.key === active) ?? groups[0];
	const max = current.rows.reduce((m, r) => Math.max(m, r.tokens), 0);

	return (
		<Card className={className}>
			<CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
				<div className="space-y-1.5">
					<CardTitle>Top consumers</CardTitle>
					<CardDescription>
						Ranked by total tokens. Cost varies with model and cache mix.
					</CardDescription>
				</div>
				<Tabs
					value={active}
					options={groups.map((g) => ({ value: g.key, label: g.title }))}
					onChange={setActive}
				/>
			</CardHeader>
			<CardContent>
				{current.rows.length === 0 ? (
					<EmptyState message="No data in window." />
				) : (
					<ol className="space-y-2">
						{current.rows.map((row, i) => {
							const pct = max > 0 ? (row.tokens / max) * 100 : 0;
							return (
								<li
									key={`${current.key}-${row.name}`}
									className="group relative grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5"
								>
									<span
										className="-z-0 pointer-events-none absolute inset-y-0 left-0 rounded-md bg-chart-1/10 transition-colors group-hover:bg-chart-1/15"
										style={{
											width: `${pct}%`,
											background: `color-mix(in oklch, var(--color-chart-1) 14%, transparent)`,
										}}
									/>
									<span className="z-1 text-muted-foreground text-xs tabular">
										{String(i + 1).padStart(2, "0")}
									</span>
									<span className="z-1 truncate text-foreground text-sm">
										{row.name}
									</span>
									<span className="z-1 flex flex-col items-end gap-0.5 text-sm">
										<span className="flex items-baseline gap-3">
											<span className="tabular text-foreground">
												{formatCompact(row.tokens)}
											</span>
											<span className="tabular text-muted-foreground text-xs">
												{formatCostCompact(row.cost)}
											</span>
										</span>
										<span className="tabular text-muted-foreground text-[10px]">
											{formatCost(row.costPerMillionTokens)}/1M ·{" "}
											{formatCacheShare(row)}
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
			<p className="text-muted-foreground text-sm">{message}</p>
		</div>
	);
}
