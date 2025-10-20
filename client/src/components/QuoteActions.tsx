/**
 * Quote Actions Component
 * 
 * Approve/Reject quote with business logic
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface QuoteActionsProps {
  quoteId: string;
  currentStatus: string;
  onSuccess?: () => void;
}

export function QuoteActions({ quoteId, currentStatus, onSuccess }: QuoteActionsProps) {
  // Using sonner toast
  const utils = trpc.useUtils();
  
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [createTasks, setCreateTasks] = useState(true);
  const [rejectReason, setRejectReason] = useState("");

  const approveMutation = trpc.business.approveQuote.useMutation({
    onSuccess: () => {
      toast.success(createTasks
        ? "Quote approved and production tasks created."
        : "Quote approved successfully.");
      utils.quotes.get.invalidate({ id: quoteId });
      setShowApproveDialog(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = trpc.business.rejectQuote.useMutation({
    onSuccess: () => {
      toast.success("Quote has been rejected.");
      utils.quotes.get.invalidate({ id: quoteId });
      setShowRejectDialog(false);
      setRejectReason("");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleApprove = () => {
    approveMutation.mutate({
      quoteId,
      createTasks,
    });
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for rejection.",
        variant: "destructive",
      });
      return;
    }

    rejectMutation.mutate({
      quoteId,
      reason: rejectReason,
    });
  };

  // Don't show actions for already approved/rejected/converted quotes
  if (["approved", "rejected", "converted", "expired"].includes(currentStatus)) {
    return null;
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          onClick={() => setShowApproveDialog(true)}
          className="bg-green-600 hover:bg-green-700"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Approve Quote
        </Button>
        <Button
          onClick={() => setShowRejectDialog(true)}
          variant="destructive"
        >
          <XCircle className="w-4 h-4 mr-2" />
          Reject Quote
        </Button>
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Quote</DialogTitle>
            <DialogDescription>
              Approve this quote and optionally create production tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="createTasks"
                checked={createTasks}
                onCheckedChange={(checked) => setCreateTasks(checked as boolean)}
              />
              <Label
                htmlFor="createTasks"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Create production tasks automatically
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              {createTasks
                ? "A production task will be created for each line item group."
                : "You can create production tasks manually later."}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              disabled={approveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? "Approving..." : "Approve Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Quote</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this quote.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="reason">Reason for Rejection</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Customer chose different vendor, pricing too high, etc."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectReason("");
              }}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={rejectMutation.isPending}
              variant="destructive"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

