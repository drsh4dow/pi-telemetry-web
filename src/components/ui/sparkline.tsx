import { cn } from "~/lib/utils";

/**
 * Tiny SVG sparkline (area + line). Pure layout, no axis. Renders nothing
 * if there are fewer than two points so the KPI card stays visually clean.
 */
export function Sparkline({
	values,
	width = 120,
	height = 32,
	stroke = "var(--color-accent)",
	fill = "var(--color-accent)",
	className,
}: {
	values: number[];
	width?: number;
	height?: number;
	stroke?: string;
	fill?: string;
	className?: string;
}) {
	if (values.length < 2) {
		return (
			<svg
				width={width}
				height={height}
				className={cn("opacity-40", className)}
				aria-hidden
			>
				<title>sparkline</title>
				<line
					x1="0"
					y1={height - 1}
					x2={width}
					y2={height - 1}
					stroke="var(--color-border-strong)"
					strokeDasharray="2 4"
				/>
			</svg>
		);
	}
	const max = Math.max(...values, 1);
	const min = Math.min(...values, 0);
	const range = max - min || 1;
	const stepX = width / (values.length - 1);
	const points = values.map((v, i) => {
		const x = i * stepX;
		const y = height - 2 - ((v - min) / range) * (height - 4);
		return [x, y] as const;
	});
	const linePath = points
		.map(
			(p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`,
		)
		.join(" ");
	const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
	const id = `spark-${Math.random().toString(36).slice(2, 8)}`;
	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			className={className}
			aria-hidden
		>
			<title>sparkline</title>
			<defs>
				<linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={fill} stopOpacity="0.35" />
					<stop offset="100%" stopColor={fill} stopOpacity="0" />
				</linearGradient>
			</defs>
			<path d={areaPath} fill={`url(#${id})`} />
			<path
				d={linePath}
				fill="none"
				stroke={stroke}
				strokeWidth="1.4"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
