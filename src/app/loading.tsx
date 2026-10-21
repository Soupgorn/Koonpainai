export default function Loading() {
  return (
    <main
      id="main"
      className="main-container"
      aria-label="Loading page"
      aria-busy="true"
    >
      <div className="page-skeleton" />
      <div className="friend-grid directory-skeleton">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="friend-skeleton" key={i}>
            <div />
            <div />
            <div />
          </div>
        ))}
      </div>
    </main>
  );
}
