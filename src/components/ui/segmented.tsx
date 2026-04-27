import { cn } from "~/lib/utils";

export function Segmented<T extends string>({
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
				"inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[oklch(1_0_0_/_0.025)] p-1 backdrop-blur",
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
							"mono rounded-[6px] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] transition",
							active
								? "bg-[oklch(1_0_0_/_0.10)] text-fg shadow-[inset_0_0_0_1px_oklch(1_0_0_/_0.10)]"
								: "text-faint hover:text-dim",
						)}
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}
