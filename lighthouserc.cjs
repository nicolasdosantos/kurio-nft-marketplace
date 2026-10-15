module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm preview --port 4174 --strictPort',
      startServerReadyPattern: 'Local',
      url: ['http://localhost:4174/'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.95 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './lighthouse-reports' },
  },
}
