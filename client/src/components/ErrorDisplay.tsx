/**
 * Error Display Components
 * 
 * User-friendly error messages for different scenarios
 */

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorDisplayProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

export function ErrorDisplay({ 
  title = "Something went wrong",
  message = "We encountered an error while loading this page. Please try again.",
  onRetry,
  showRetry = true
}: ErrorDisplayProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        {showRetry && onRetry && (
          <CardContent>
            <Button onClick={onRetry} variant="outline" className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
      <AlertCircle className="w-4 h-4" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ 
  title, 
  description, 
  action 
}: { 
  title: string; 
  description: string; 
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="max-w-md space-y-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
        {action && <div className="pt-4">{action}</div>}
      </div>
    </div>
  );
}

