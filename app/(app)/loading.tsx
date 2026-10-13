export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div>
        <div className="h-7 w-48 bg-slate-200 rounded mb-2" />
        <div className="h-4 w-72 bg-slate-100 rounded" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-white p-4 space-y-2">
            <div className="h-3 w-16 bg-slate-100 rounded" />
            <div className="h-8 w-12 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border bg-white overflow-x-auto">
        <div className="bg-slate-50 border-b px-4 py-3">
          <div className="h-4 w-24 bg-slate-200 rounded" />
        </div>
        <div className="divide-y">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex gap-4">
              <div className="h-4 w-32 bg-slate-100 rounded" />
              <div className="h-4 w-24 bg-slate-100 rounded" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-100 rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}