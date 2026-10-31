export function revealActiveNavigation(): void {
  if (!window.matchMedia('(max-width: 720px)').matches) return;
  const active = document.querySelector<HTMLElement>('.sidebar .nav-link[aria-current="page"]');
  const navigation = active?.parentElement;
  if (!active || !navigation) return;
  navigation.scrollTo({
    left: active.offsetLeft - navigation.clientWidth / 2 + active.clientWidth / 2,
    behavior: 'instant',
  });
}
