/**
 * Payment Form Component
 * 
 * Record payments on invoices
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { DollarSign } from "lucide-react";
import { toast } from "sonner";

interface PaymentFormProps {
  invoiceId: string;
  invoiceNumber: string;
  balanceDue: number;
  onSuccess?: () => void;
}

export function PaymentForm({
  invoiceId,
  invoiceNumber,
  balanceDue,
  onSuccess,
}: PaymentFormProps) {
  // Using sonner toast
  const utils = trpc.useUtils();
  
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");

  const recordPaymentMutation = trpc.business.recordPayment.useMutation({
    onSuccess: (result) => {
      toast.success(`Payment of $${parseFloat(amount).toFixed(2)} recorded. New balance: $${result.balance.toFixed(2)}`);
      
      if (result.newStatus === "paid") {
        toast.success("Invoice fully paid!");
      }

      utils.invoices.get.invalidate({ id: invoiceId });
      setOpen(false);
      resetForm();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setAmount("");
    setPaymentMethod("cash");
    setNotes("");
  };

  const handleSubmit = () => {
    const paymentAmount = parseFloat(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }

    if (paymentAmount > balanceDue * 1.5) {
      toast({
        title: "Large Overpayment",
        description: "Payment amount seems unusually high. Please verify.",
        variant: "destructive",
      });
      return;
    }

    recordPaymentMutation.mutate({
      invoiceId,
      amount: paymentAmount,
      paymentMethod,
      notes: notes.trim() || undefined,
    });
  };

  const setFullBalance = () => {
    setAmount(balanceDue.toFixed(2));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <DollarSign className="w-4 h-4 mr-2" />
          Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for Invoice #{invoiceNumber}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Balance Due</Label>
            <div className="text-2xl font-bold text-primary">
              ${balanceDue.toFixed(2)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount *</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={setFullBalance}
              >
                Full Balance
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Payment Method *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="debit_card">Debit Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="venmo">Venmo</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="e.g., Check #1234, Transaction ID, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              resetForm();
            }}
            disabled={recordPaymentMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={recordPaymentMutation.isPending}
          >
            {recordPaymentMutation.isPending
              ? "Recording..."
              : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

