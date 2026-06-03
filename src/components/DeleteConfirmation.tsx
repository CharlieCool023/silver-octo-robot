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

  const handleClose = () => {
    setStage(1);
    onOpenChange(false);
  };

  const handleFirstConfirm = () => {
    setStage(2);
  };

  const handleFinalConfirm = async () => {
    await onConfirm();
    handleClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        {stage === 1 ? (
          <>
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
                <AlertDialogTitle>Delete Member?</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="mt-2">
                You are about to delete <span className="font-semibold text-gray-900">{memberName}</span>'s record. This includes all evaluation data and comments.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 my-4">
              <p className="text-sm text-red-800">
                <span className="font-semibold">Warning:</span> This action will permanently remove all associated data and cannot be undone.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleClose} disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleFirstConfirm}
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
                <AlertDialogTitle>Confirm Permanent Deletion</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="mt-2">
                This action cannot be undone. Once you delete {memberName}'s record, it will be permanently lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="bg-red-100 border border-red-400 rounded-lg p-4 my-4">
              <p className="text-sm font-semibold text-red-900">
                Are you absolutely certain? Type "delete" if you want to proceed.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel 
                onClick={() => setStage(1)} 
                disabled={isDeleting}
              >
                Back
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleFinalConfirm}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
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
