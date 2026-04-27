import { cn } from "~/lib/utils";

export function Skeleton({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"animate-shimmer rounded-md bg-[oklch(1_0_0_/_0.04)]",
				className,
			)}
		/>
	);
}
