import type { HTMLAttributes } from "react";
import { cn } from "~/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"glass relative overflow-hidden rounded-[var(--radius-xl)]",
				className,
			)}
			{...props}
		/>
	);
}

export function CardHeader({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"flex items-start justify-between gap-3 px-6 pt-5 pb-3",
				className,
			)}
			{...props}
		/>
	);
}

export function CardTitle({
	className,
	...props
}: HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h2
			className={cn(
				"display text-fg text-[1.05rem] leading-tight tracking-tight",
				className,
			)}
			{...props}
		/>
	);
}

export function CardDescription({
	className,
	...props
}: HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn("mt-0.5 text-[12px] text-muted leading-snug", className)}
			{...props}
		/>
	);
}

export function CardContent({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("px-6 pb-5", className)} {...props} />;
}

/**
 * Section eyebrow + display title used for full-page section headers.
 * Asymmetric: small uppercase eyebrow above a serif title.
 */
export function SectionHeader({
	eyebrow,
	title,
	subtitle,
	right,
	className,
}: {
	eyebrow?: string;
	title: string;
	subtitle?: string;
	right?: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-end justify-between gap-3",
				className,
			)}
		>
			<div>
				{eyebrow ? (
					<p className="mono text-[10.5px] text-faint uppercase tracking-[0.22em]">
						{eyebrow}
					</p>
				) : null}
				<h2 className="display mt-1 text-2xl text-fg leading-tight tracking-tight">
					{title}
				</h2>
				{subtitle ? (
					<p className="mt-1 text-muted text-sm">{subtitle}</p>
				) : null}
			</div>
			{right ? <div className="flex items-center gap-2">{right}</div> : null}
		</div>
	);
}
