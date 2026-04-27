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
				<Dialog.Backdrop className="fixed inset-0 bg-black/35" />
				<Dialog.Viewport className="fixed inset-0 flex items-center justify-center p-4">
					<Dialog.Popup className="w-full max-w-md rounded-xl border bg-white p-5 shadow-xl">
						<Dialog.Title className="font-semibold text-lg">
							{props.title}
						</Dialog.Title>
						<Dialog.Description className="mt-2 text-muted-foreground text-sm">
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
