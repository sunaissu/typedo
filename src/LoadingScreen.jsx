export default function LoadingScreen({ message }) {
  return <main className="storage-loading">
    <div className="loading-content">
      <div className="loading-brand"><span className="loading-mark" aria-hidden="true">t<span /></span><h1>Typedo<span>.</span></h1></div>
      <p className="loading-description">Typing tests, lessons and stories.</p>
      <p className="loading-message" role="status">{message}</p>
    </div>
  </main>;
}
