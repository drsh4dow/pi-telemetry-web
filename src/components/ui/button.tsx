import type { ButtonHTMLAttributes } from "react";
import { cn } from "~/lib/utils";

export function Button({
	className,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export function SecondaryButton({
	className,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center rounded-md border bg-white px-3 py-2 font-medium text-foreground text-sm shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export function DangerButton({
	className,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center rounded-md bg-destructive px-3 py-2 font-medium text-primary-foreground text-sm shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}
