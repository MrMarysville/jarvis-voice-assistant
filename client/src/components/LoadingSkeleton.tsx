/**
 * Loading Skeleton Components
 * 
 * Reusable loading skeletons for different content types
 */

export function CardSkeleton() {
  return (
    <div className="border rounded-lg p-6 animate-pulse">
      <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
      <div className="h-8 bg-muted rounded w-1/2"></div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted p-4">
        <div className="h-4 bg-muted-foreground/20 rounded w-full"></div>
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 animate-pulse">
            <div className="grid grid-cols-4 gap-4">
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div>
        <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
        <div className="h-10 bg-muted rounded w-full"></div>
      </div>
      <div>
        <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
        <div className="h-10 bg-muted rounded w-full"></div>
      </div>
      <div>
        <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
        <div className="h-24 bg-muted rounded w-full"></div>
      </div>
      <div className="h-10 bg-muted rounded w-32"></div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="p-8 space-y-6">
      <div className="animate-pulse">
        <div className="h-8 bg-muted rounded w-1/4 mb-2"></div>
        <div className="h-4 bg-muted rounded w-1/2"></div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <TableSkeleton />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="p-8 space-y-6">
      <div className="animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
            <div className="h-6 bg-muted rounded w-3/4"></div>
          </div>
          <div>
            <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
            <div className="h-6 bg-muted rounded w-3/4"></div>
          </div>
        </div>
      </div>
      <div className="border rounded-lg p-6 space-y-4 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-full"></div>
          <div className="h-4 bg-muted rounded w-5/6"></div>
          <div className="h-4 bg-muted rounded w-4/6"></div>
        </div>
      </div>
    </div>
  );
}

