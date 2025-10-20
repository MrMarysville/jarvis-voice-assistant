/**
 * Activity Log Component
 * 
 * Display audit trail for quotes, invoices, etc.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Clock, User } from "lucide-react";

interface ActivityLogProps {
  entityType: "quote" | "invoice" | "customer" | "product" | "task";
  entityId: string;
}

export function ActivityLog({ entityType, entityId }: ActivityLogProps) {
  const { data: activities = [], isLoading } = trpc.activity.list.useQuery({
    entityType,
    entityId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No activity yet</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity: any) => (
            <div
              key={activity.id}
              className="flex gap-3 pb-4 border-b last:border-0 last:pb-0"
            >
              <div className="mt-1">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium capitalize">
                    {activity.action.replace(/_/g, " ")}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {new Date(activity.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {activity.description}
                </div>
                {activity.userId && (
                  <div className="text-xs text-muted-foreground">
                    User ID: {activity.userId}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

