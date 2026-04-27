import {
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { DashboardData } from "~/lib/dashboard";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";

export function DashboardCharts({ data }: { data: DashboardData }) {
	return (
		<div className="grid gap-4 lg:grid-cols-3">
			<Card className="lg:col-span-2">
				<CardHeader>
					<CardTitle>Usage over time</CardTitle>
					<CardDescription>Daily turns and tokens.</CardDescription>
				</CardHeader>
				<CardContent className="h-72">
					<ResponsiveContainer width="100%" height="100%">
						<LineChart data={data.series} margin={{ left: 8, right: 8 }}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" tickMargin={8} />
							<YAxis yAxisId="left" tickMargin={8} />
							<YAxis yAxisId="right" orientation="right" tickMargin={8} />
							<Tooltip />
							<Line
								yAxisId="left"
								type="monotone"
								dataKey="turns"
								stroke="var(--color-chart-1)"
								strokeWidth={2}
							/>
							<Line
								yAxisId="right"
								type="monotone"
								dataKey="tokens"
								stroke="var(--color-chart-2)"
								strokeWidth={2}
							/>
						</LineChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>
			<Breakdown title="Top models" data={data.byModel} />
			<Breakdown title="Top projects" data={data.byProject} />
			<Breakdown title="Top developers" data={data.byDeveloper} />
		</div>
	);
}

function Breakdown({
	title,
	data,
}: {
	title: string;
	data: Array<{ name: string; tokens: number }>;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>By total tokens.</CardDescription>
			</CardHeader>
			<CardContent className="h-64">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart
						data={data}
						layout="vertical"
						margin={{ left: 8, right: 8 }}
					>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis type="number" hide />
						<YAxis dataKey="name" type="category" width={92} tickMargin={8} />
						<Tooltip />
						<Bar dataKey="tokens" fill="var(--color-chart-1)" radius={4} />
					</BarChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}
