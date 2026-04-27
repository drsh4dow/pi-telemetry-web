import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

export function ConfirmDialog(props: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
			<Dialog.Portal>
				<Dialog.Backdrop className="fixed inset-0 bg-[oklch(0_0_0_/_0.55)] backdrop-blur-sm" />
				<Dialog.Viewport className="fixed inset-0 flex items-center justify-center p-4">
					<Dialog.Popup className="glass-strong w-full max-w-md rounded-[var(--radius-xl)] p-6">
						<Dialog.Title className="display text-fg text-lg">
							{props.title}
						</Dialog.Title>
						<Dialog.Description className="mt-2 text-muted text-sm">
							{props.description}
						</Dialog.Description>
						<div className={cn("mt-5 flex justify-end gap-2")}>
							{props.children}
						</div>
					</Dialog.Popup>
				</Dialog.Viewport>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

export const DialogClose = Dialog.Close;

/**
 * Side-anchored drawer used for event detail. Slides in from the right.
 */
export function Drawer(props: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title?: ReactNode;
	subtitle?: ReactNode;
	children: ReactNode;
	width?: string;
}) {
	return (
		<Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
			<Dialog.Portal>
				<Dialog.Backdrop className="fixed inset-0 bg-[oklch(0_0_0_/_0.55)] backdrop-blur-sm data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-300" />
				<Dialog.Viewport className="fixed inset-0 flex justify-end p-3 sm:p-4">
					<Dialog.Popup
						style={{ width: props.width ?? "min(560px, 100%)" }}
						className="glass-strong flex h-full flex-col overflow-hidden rounded-[var(--radius-xl)] data-[starting-style]:translate-x-6 data-[starting-style]:opacity-0 data-[ending-style]:translate-x-6 data-[ending-style]:opacity-0 transition-[transform,opacity] duration-300 ease-[var(--ease-out-quint)]"
					>
						{props.title || props.subtitle ? (
							<div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-6 pt-5 pb-4">
								<div>
									{props.title ? (
										<Dialog.Title className="display text-fg text-lg leading-tight">
											{props.title}
										</Dialog.Title>
									) : null}
									{props.subtitle ? (
										<Dialog.Description className="mt-1 text-muted text-xs">
											{props.subtitle}
										</Dialog.Description>
									) : null}
								</div>
								<Dialog.Close
									aria-label="Close"
									className="rounded-md p-1 text-muted hover:bg-[oklch(1_0_0_/_0.06)] hover:text-fg"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.8"
										strokeLinecap="round"
									>
										<title>Close</title>
										<path d="M18 6 6 18M6 6l12 12" />
									</svg>
								</Dialog.Close>
							</div>
						) : null}
						<div className="flex-1 overflow-auto px-6 py-5">
							{props.children}
						</div>
					</Dialog.Popup>
				</Dialog.Viewport>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
