import React from "react";
import { Card, Skeleton } from "./ui";

/**
 * Page-level skeleton loaders for consistent shimmer states across pages.
 * Use these instead of plain <Spinner /> for a more polished UX.
 */

/* ─── Table skeleton ──────────────────────────────────────────── */
export const TableSkeleton = ({ rows = 6, cols = 4 }) => (
  <Card className="overflow-hidden">
    {/* Header row */}
    <div className="px-5 py-3 bg-gray-50 dark:bg-white/[0.03] border-b border-gray-200 dark:border-white/[0.06] flex gap-4">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} variant="text" className="h-3 w-20" />
      ))}
    </div>
    {/* Body rows */}
    <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-5 py-4 flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} variant="text" className={`h-3 ${c === 0 ? "w-32" : "w-16"}`} />
          ))}
        </div>
      ))}
    </div>
  </Card>
);

/* ─── Stat cards skeleton ─────────────────────────────────────── */
export const StatCardsSkeleton = ({ count = 4 }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="p-5 space-y-3">
        <Skeleton variant="text" className="h-3 w-16" />
        <Skeleton variant="title" className="h-7 w-12" />
      </Card>
    ))}
  </div>
);

/* ─── Chart grid skeleton ─────────────────────────────────────── */
export const ChartGridSkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-white/[0.06] flex items-center gap-3">
          <Skeleton variant="avatar" className="h-8 w-8 rounded-lg" />
          <Skeleton variant="text" className="h-4 w-32" />
        </div>
        <div className="p-5">
          <Skeleton variant="card" className="h-52" />
        </div>
      </Card>
    ))}
  </div>
);

/* ─── Screenshot gallery skeleton ─────────────────────────────── */
export const GallerySkeleton = ({ count = 12 }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="overflow-hidden">
        <Skeleton variant="card" className="h-40 rounded-none" />
        <div className="p-3 space-y-2">
          <Skeleton variant="text" className="h-3 w-3/4" />
          <Skeleton variant="text" className="h-3 w-1/2" />
        </div>
      </Card>
    ))}
  </div>
);

/* ─── Detail page skeleton ────────────────────────────────────── */
export const DetailSkeleton = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-4">
      <Skeleton variant="avatar" className="h-10 w-10" />
      <div className="space-y-2 flex-1">
        <Skeleton variant="title" className="h-5 w-48" />
        <Skeleton variant="text" className="h-3 w-72" />
      </div>
    </div>
    <StatCardsSkeleton count={4} />
    <TableSkeleton rows={8} cols={5} />
  </div>
);
