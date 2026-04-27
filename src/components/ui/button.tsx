import type { ButtonHTMLAttributes } from "react";
import { cn } from "~/lib/utils";

const base =
	"inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-3.5 h-9 font-medium text-sm transition-[background,color,border-color,opacity,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 select-none";

export function Button({
	className,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			className={cn(
				base,
				"bg-[var(--color-accent)] text-[var(--color-primary-foreground)] shadow-[0_0_0_1px_oklch(1_0_0_/_0.04)_inset,0_8px_24px_-12px_var(--color-accent)] hover:brightness-110",
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
				base,
				"border border-[var(--color-border-strong)] bg-[oklch(1_0_0_/_0.03)] text-fg backdrop-blur hover:bg-[oklch(1_0_0_/_0.06)] hover:border-[var(--color-border-bright)]",
				className,
			)}
			{...props}
		/>
	);
}

export function GhostButton({
	className,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			className={cn(
				base,
				"text-dim hover:bg-[oklch(1_0_0_/_0.04)] hover:text-fg",
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
				base,
				"bg-[var(--color-destructive)] text-white shadow-[0_8px_24px_-12px_var(--color-destructive)] hover:brightness-110",
				className,
			)}
			{...props}
		/>
	);
}
