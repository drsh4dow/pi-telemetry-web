import type {
	InputHTMLAttributes,
	LabelHTMLAttributes,
	SelectHTMLAttributes,
	TextareaHTMLAttributes,
} from "react";
import { cn } from "~/lib/utils";

const fieldBase =
	"flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export function Label({
	className,
	...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: callers attach htmlFor or wrap an input.
		<label
			className={cn(
				"font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
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
				"appearance-none bg-[length:14px_14px] bg-[right_0.6rem_center] bg-no-repeat pr-9",
				className,
			)}
			style={{
				backgroundImage:
					"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%23a1a1aa' stroke-width='1.6'><path d='M6 8l4 4 4-4'/></svg>\")",
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
