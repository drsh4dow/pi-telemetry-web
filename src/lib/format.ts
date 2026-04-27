/** Cheap, locale-friendly formatters used across the dashboard. */

export function formatCompact(value: number): string {
	if (!Number.isFinite(value)) return "—";
	const abs = Math.abs(value);
	if (abs < 1000) return new Intl.NumberFormat().format(Math.round(value));
	return new Intl.NumberFormat(undefined, {
		notation: "compact",
		maximumFractionDigits: abs < 10_000 ? 2 : 1,
	}).format(value);
}

export function formatCount(value: number): string {
	return new Intl.NumberFormat().format(value);
}

export function formatCost(value: number): string {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: value >= 100 ? 2 : 4,
	}).format(value);
}

export function formatCostCompact(value: number): string {
	if (!Number.isFinite(value)) return "—";
	const abs = Math.abs(value);
	if (abs >= 1000) {
		return `$${new Intl.NumberFormat(undefined, {
			notation: "compact",
			maximumFractionDigits: 2,
		}).format(value)}`;
	}
	return formatCost(value);
}

export function formatPercent(value: number): string {
	if (!Number.isFinite(value)) return "—";
	const sign = value > 0 ? "+" : "";
	return `${sign}${value.toFixed(value >= 100 || value <= -100 ? 0 : 1)}%`;
}

export function formatRelative(value: string | number | Date): string {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const diffSec = (date.getTime() - Date.now()) / 1000;
	const abs = Math.abs(diffSec);
	const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
	if (abs < 60) return rtf.format(Math.round(diffSec), "second");
	if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
	if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), "hour");
	if (abs < 86_400 * 7) return rtf.format(Math.round(diffSec / 86_400), "day");
	if (abs < 86_400 * 30)
		return rtf.format(Math.round(diffSec / 86_400 / 7), "week");
	if (abs < 86_400 * 365)
		return rtf.format(Math.round(diffSec / 86_400 / 30), "month");
	return rtf.format(Math.round(diffSec / 86_400 / 365), "year");
}

export function formatAbsolute(value: string | number | Date): string {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "short",
		timeStyle: "medium",
	}).format(date);
}

export function deltaPercent(current: number, previous: number): number | null {
	if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
	if (previous === 0) {
		if (current === 0) return 0;
		return null;
	}
	return ((current - previous) / Math.abs(previous)) * 100;
}
