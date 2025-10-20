/**
 * Status Badge Component
 * 
 * Display status with appropriate colors
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  type?: "quote" | "invoice" | "task";
  className?: string;
}

export function StatusBadge({ status, type = "quote", className }: StatusBadgeProps) {
  const getVariant = () => {
    const statusLower = status.toLowerCase();

    // Quote statuses
    if (type === "quote") {
      switch (statusLower) {
        case "approved":
          return "success";
        case "rejected":
        case "expired":
          return "destructive";
        case "sent":
          return "warning";
        case "converted":
          return "info";
        case "draft":
        default:
          return "secondary";
      }
    }

    // Invoice statuses
    if (type === "invoice") {
      switch (statusLower) {
        case "paid":
          return "success";
        case "overdue":
        case "cancelled":
          return "destructive";
        case "partial":
          return "warning";
        case "pending":
          return "info";
        case "draft":
        default:
          return "secondary";
      }
    }

    // Task statuses
    if (type === "task") {
      switch (statusLower) {
        case "completed":
          return "success";
        case "in_progress":
          return "warning";
        case "pending":
          return "info";
        case "cancelled":
          return "destructive";
        default:
          return "secondary";
      }
    }

    return "secondary";
  };

  const variant = getVariant();

  const variantStyles = {
    success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    destructive: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
    warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
    info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    secondary: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  };

  return (
    <Badge
      className={cn(
        variantStyles[variant],
        "capitalize font-medium",
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

