import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <p className="num text-5xl font-semibold text-accent">404</p>
      <h1 className="mt-3 font-mono text-lg font-semibold">Page not found</h1>
      <p className="mt-1.5 text-sm text-muted">That page doesn&apos;t exist, or it moved.</p>
      <Link href="/" className="btn-primary mt-6">Back to Research</Link>
    </div>
  );
}
