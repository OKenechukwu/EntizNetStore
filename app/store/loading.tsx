export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="w-full aspect-square bg-gray-200 rounded-xl" />
          <div className="mt-3 h-4 bg-gray-200 rounded w-2/3" />
          <div className="mt-2 h-4 bg-gray-200 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}
