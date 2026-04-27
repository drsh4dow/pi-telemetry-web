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
				<Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
				<Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<Dialog.Popup className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
						<Dialog.Title className="font-semibold text-base leading-none tracking-tight">
							{props.title}
						</Dialog.Title>
						<Dialog.Description className="mt-2 text-muted-foreground text-sm">
							{props.description}
						</Dialog.Description>
						<div className={cn("mt-6 flex justify-end gap-2")}>
							{props.children}
						</div>
					</Dialog.Popup>
				</Dialog.Viewport>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

export const DialogClose = Dialog.Close;

/** Side-anchored sheet, used for event detail. */
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
				<Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
				<Dialog.Viewport className="fixed inset-0 z-50 flex justify-end">
					<Dialog.Popup
						style={{ width: props.width ?? "min(540px, 100%)" }}
						className="flex h-full flex-col overflow-hidden border-border border-l bg-card shadow-2xl transition-transform duration-200 data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full"
					>
						{props.title || props.subtitle ? (
							<div className="flex items-start justify-between gap-3 border-border border-b px-6 py-4">
								<div>
									{props.title ? (
										<Dialog.Title className="font-semibold text-base leading-none tracking-tight">
											{props.title}
										</Dialog.Title>
									) : null}
									{props.subtitle ? (
										<Dialog.Description className="mt-1.5 text-muted-foreground text-xs">
											{props.subtitle}
										</Dialog.Description>
									) : null}
								</div>
								<Dialog.Close
									aria-label="Close"
									className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
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
