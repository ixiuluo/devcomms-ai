import { APP_NAME, APP_VERSION } from '@dra/shared';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold text-dra-700 mb-4">DevComms AI</h1>
        <p className="text-xl text-changelog-muted mb-8">
          Automated changelogs from your git history. AI writes, you approve, the world sees.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/changelog"
            className="rounded-lg bg-dra-600 px-6 py-3 text-white font-medium hover:bg-dra-700 transition-colors"
          >
            View Demo Changelog
          </a>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/health`}
            className="rounded-lg border border-dra-300 px-6 py-3 text-dra-700 font-medium hover:bg-dra-50 transition-colors"
          >
            API Health
          </a>
        </div>
        <p className="mt-6 text-sm text-changelog-muted">
          {APP_NAME} v{APP_VERSION}
        </p>
      </div>
    </main>
  );
}
