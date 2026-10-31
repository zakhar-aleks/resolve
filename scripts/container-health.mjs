try {
  for (const [url, headers] of [
    ['http://127.0.0.1:8787/', {}],
    [
      'http://127.0.0.1:8788/api/state',
      { 'X-Resolve-Internal': process.env.INTERNAL_API_TOKEN ?? '' },
    ],
  ]) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(4000) });
    await response.body?.cancel();
    if (!response.ok) process.exit(1);
  }
} catch {
  process.exit(1);
}
