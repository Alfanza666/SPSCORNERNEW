import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div 
      className={`animate-pulse bg-zinc-200 rounded-xl ${className}`}
      {...props}
    />
  );
};

export const ProductSkeleton: React.FC = () => (
  <div className="p-4 space-y-4">
    <div className="flex items-center gap-4">
      <Skeleton className="w-16 h-16 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  </div>
);

export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
  <tr className="border-b border-zinc-100">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="p-6">
        <Skeleton className="h-4 w-full max-w-[120px]" />
      </td>
    ))}
  </tr>
);

export const TransactionSkeleton: React.FC = () => (
  <div className="p-4 space-y-3">
    <div className="flex justify-between items-start">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
    <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-100 flex justify-between items-center">
      <div className="space-y-1">
        <Skeleton className="h-2 w-10" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="text-right space-y-1">
        <Skeleton className="h-2 w-10 ml-auto" />
        <Skeleton className="h-3 w-20 ml-auto" />
      </div>
    </div>
    <Skeleton className="h-8 w-full rounded-lg" />
  </div>
);
