import { cn } from "~/lib/utils";

/**
 * Minimal shadcn-style tabs (segmented control). Uncontrolled API mirrors
 * shadcn's, but built on a plain button group to avoid pulling in another
 * Radix dependency.
 */
export function Tabs<T extends string>({
	value,
	options,
	onChange,
	ariaLabel,
	className,
}: {
	value: T;
	options: Array<{ value: T; label: string }>;
	onChange: (value: T) => void;
	ariaLabel?: string;
	className?: string;
}) {
	return (
		<div
			role="tablist"
			aria-label={ariaLabel}
			className={cn(
				"inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
				className,
			)}
		>
			{options.map((opt) => {
				const active = opt.value === value;
				return (
					<button
						key={opt.value}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(opt.value)}
						className={cn(
							"inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 font-medium text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							active
								? "bg-background text-foreground shadow-sm"
								: "hover:text-foreground",
						)}
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}
