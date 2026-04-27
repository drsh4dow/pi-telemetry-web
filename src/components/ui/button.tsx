import type { ButtonHTMLAttributes } from "react";
import { cn } from "~/lib/utils";

const base =
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const sizes = {
	default: "h-9 px-4 py-2",
	sm: "h-8 rounded-md px-3 text-xs",
	icon: "h-9 w-9",
} as const;

interface VariantProps {
	size?: keyof typeof sizes;
}

export function Button({
	className,
	size = "default",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps) {
	return (
		<button
			className={cn(
				base,
				sizes[size],
				"bg-primary text-primary-foreground shadow hover:bg-primary/90",
				className,
			)}
			{...props}
		/>
	);
}

export function SecondaryButton({
	className,
	size = "default",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps) {
	return (
		<button
			className={cn(
				base,
				sizes[size],
				"border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export function GhostButton({
	className,
	size = "default",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps) {
	return (
		<button
			className={cn(
				base,
				sizes[size],
				"text-muted-foreground hover:bg-accent hover:text-accent-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export function DangerButton({
	className,
	size = "default",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps) {
	return (
		<button
			className={cn(
				base,
				sizes[size],
				"bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
				className,
			)}
			{...props}
		/>
	);
}
