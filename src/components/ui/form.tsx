import type {
	InputHTMLAttributes,
	LabelHTMLAttributes,
	SelectHTMLAttributes,
	TextareaHTMLAttributes,
} from "react";
import { cn } from "~/lib/utils";

const fieldBase =
	"h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[oklch(1_0_0_/_0.025)] px-3 text-sm text-fg outline-none transition placeholder:text-faint hover:border-[var(--color-border-bright)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)]";

export function Label({
	className,
	...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: reusable label — callers attach htmlFor or wrap an input.
		<label
			className={cn(
				"mono text-[10.5px] text-faint uppercase tracking-[0.18em]",
				className,
			)}
			{...props}
		/>
	);
}

export function Input({
	className,
	...props
}: InputHTMLAttributes<HTMLInputElement>) {
	return <input className={cn(fieldBase, className)} {...props} />;
}

export function Select({
	className,
	children,
	...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select
			className={cn(
				fieldBase,
				"appearance-none bg-[length:16px_16px] bg-[right_0.5rem_center] bg-no-repeat pr-8",
				className,
			)}
			style={{
				backgroundImage:
					"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%239aa3ad' stroke-width='1.6'><path d='M6 8l4 4 4-4'/></svg>\")",
			}}
			{...props}
		>
			{children}
		</select>
	);
}

export function Textarea({
	className,
	...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return (
		<textarea
			className={cn(fieldBase, "min-h-32 py-2", className)}
			{...props}
		/>
	);
}
