import type {
	InputHTMLAttributes,
	LabelHTMLAttributes,
	SelectHTMLAttributes,
	TextareaHTMLAttributes,
} from "react";
import { cn } from "~/lib/utils";

export function Label({
	className,
	...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
	// biome-ignore lint/a11y/noLabelWithoutControl: reusable labels receive htmlFor when paired with a control.
	return <label className={cn("font-medium text-sm", className)} {...props} />;
}

export function Input({
	className,
	...props
}: InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			className={cn(
				"h-10 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20",
				className,
			)}
			{...props}
		/>
	);
}

export function Select({
	className,
	...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select
			className={cn(
				"h-10 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20",
				className,
			)}
			{...props}
		/>
	);
}

export function Textarea({
	className,
	...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return (
		<textarea
			className={cn(
				"min-h-32 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20",
				className,
			)}
			{...props}
		/>
	);
}
