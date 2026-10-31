export function requestLimits(maximum = 300, interval = 60000): () => boolean {
  let start = Date.now();
  let count = 0;
  return () => {
    if (Date.now() - start >= interval) {
      start = Date.now();
      count = 0;
    }
    return ++count <= maximum;
  };
}
