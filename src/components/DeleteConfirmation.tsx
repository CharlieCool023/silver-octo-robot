import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmationProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
}

export default function DeleteConfirmation({
  isOpen,
  onOpenChange,
  memberName,
  onConfirm,
  isDeleting = false,
}: DeleteConfirmationProps) {
  const [stage, setStage] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState("");

  const handleClose = () => {
    setStage(1);
    setConfirmText("");
    onOpenChange(false);
  };

  const handleFinalConfirm = async () => {
    await onConfirm();
    handleClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <AlertDialogContent className="max-w-md">
        {stage === 1 ? (
          <>
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
                <AlertDialogTitle>Delete Member?</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="mt-2">
                You are about to permanently delete{" "}
                <span className="font-semibold text-gray-900">{memberName}</span>'s
                record including all evaluations and comments.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 my-2">
              <p className="text-sm text-red-800">
                <span className="font-semibold">Warning:</span> This cannot be undone.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleClose} disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => setStage(2)}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                <AlertDialogTitle>Final Confirmation</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="mt-2">
                Type <span className="font-bold text-gray-900">DELETE</span> to confirm
                permanent deletion of {memberName}'s record.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type DELETE here'
              className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-sm"
              autoFocus
            />
            <AlertDialogFooter className="mt-2">
              <AlertDialogCancel onClick={() => { setStage(1); setConfirmText(""); }} disabled={isDeleting}>
                Back
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleFinalConfirm}
                disabled={isDeleting || confirmText !== "DELETE"}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete Permanently"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
