export default function Loading() {
  return (
    <div className="grid gap-4 p-6" aria-busy="true" aria-label="Loading">
      <span className="h-8 w-56 animate-pulse rounded-md bg-neutral-pill" />
      <span className="h-24 animate-pulse rounded-md bg-neutral-pill/60" />
      <span className="h-64 animate-pulse rounded-md bg-neutral-pill/60" />
    </div>
  );
}
