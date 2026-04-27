import type { HTMLAttributes } from "react";
import { cn } from "~/lib/utils";

const variants = {
	default: "border-transparent bg-primary text-primary-foreground",
	secondary: "border-transparent bg-secondary text-secondary-foreground",
	outline: "text-foreground",
	positive: "border-transparent bg-emerald-500/15 text-emerald-400",
	negative: "border-transparent bg-rose-500/15 text-rose-400",
	muted: "border-transparent bg-muted text-muted-foreground",
} as const;

export function Badge({
	className,
	variant = "default",
	...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium text-xs",
				variants[variant],
				className,
			)}
			{...props}
		/>
	);
}
