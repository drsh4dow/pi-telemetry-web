import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

export function Chip({
	children,
	onRemove,
	tone = "default",
	className,
}: {
	children: ReactNode;
	onRemove?: () => void;
	tone?: "default" | "accent" | "positive" | "negative";
	className?: string;
}) {
	const tones = {
		default:
			"border-[var(--color-border-strong)] bg-[oklch(1_0_0_/_0.04)] text-dim",
		accent:
			"border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
		positive:
			"border-[var(--color-positive)]/30 bg-[oklch(0.82_0.15_162_/_0.12)] text-[var(--color-positive)]",
		negative:
			"border-[var(--color-negative)]/30 bg-[oklch(0.72_0.2_18_/_0.14)] text-[var(--color-negative)]",
	} as const;
	return (
		<span
			className={cn(
				"mono inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] uppercase tracking-[0.14em]",
				tones[tone],
				className,
			)}
		>
			{children}
			{onRemove ? (
				<button
					type="button"
					aria-label="Remove filter"
					onClick={onRemove}
					className="-mr-0.5 ml-0.5 rounded-full p-0.5 text-current/70 hover:bg-[oklch(1_0_0_/_0.08)] hover:text-current"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="10"
						height="10"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.4"
						strokeLinecap="round"
					>
						<title>Remove</title>
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			) : null}
		</span>
	);
}
