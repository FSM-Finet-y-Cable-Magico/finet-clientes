function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl bg-surface p-5 shadow-sm animate-pulse flex flex-col gap-3 ${className}`}>
      <div className="h-3 w-24 rounded bg-surface-deep" />
      <div className="h-6 w-32 rounded bg-surface-deep" />
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Saludo */}
      <div className="animate-pulse flex flex-col gap-2">
        <div className="h-3 w-24 rounded bg-surface-deep" />
        <div className="h-7 w-48 rounded bg-surface-deep" />
      </div>

      {/* Estado + Plan — 1 col en móvil, 2 cols en md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Deuda */}
      <SkeletonCard />

      {/* WiFi */}
      <div className="rounded-2xl bg-surface p-5 shadow-sm animate-pulse flex flex-col gap-3">
        <div className="h-3 w-36 rounded bg-surface-deep" />
        <div className="h-8 w-full rounded bg-surface-deep" />
        <div className="h-9 w-32 rounded-full bg-surface-deep" />
      </div>

      {/* Tickets */}
      <div className="rounded-2xl bg-surface p-5 shadow-sm animate-pulse flex flex-col gap-3">
        <div className="h-3 w-28 rounded bg-surface-deep" />
        <div className="h-16 w-full rounded bg-surface-deep" />
        <div className="h-16 w-full rounded bg-surface-deep" />
      </div>
    </div>
  );
}
