export default function LoadingCards() {
  return (
    <div className="grid-auto">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="card card-pad">
          <div className="skeleton w-10 h-10" />
          <div className="skeleton w-24 h-7 mt-5" />
          <div className="skeleton w-32 h-3 mt-3" />
        </div>
      ))}
    </div>
  );
}
