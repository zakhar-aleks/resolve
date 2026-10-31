import { revealActiveNavigation } from '../helpers/navigation';
import { importPolicy } from '../helpers/policy-import';
import { copyText } from '../helpers/copy';
import htmx from 'htmx.org';
import { COPY } from '../consts/copy';
htmx.config.allowEval = false;
htmx.config.selfRequestsOnly = true;
htmx.config.historyCacheSize = 0;
revealActiveNavigation();
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const dialog = document.querySelector<HTMLDialogElement>('#case-dialog');
  if (event.target.closest('[data-open-dialog]')) dialog?.showModal();
  if (event.target.closest('[data-close-dialog]')) dialog?.close();
});
document.addEventListener('input', (event) => {
  if (event.target instanceof HTMLTextAreaElement && event.target.id === 'policy-document') {
    const counter = document.querySelector('[data-policy-length]');
    if (counter) counter.textContent = copyText.characters(event.target.value.length);
  }
});
document.addEventListener('change', (event) => {
  if (event.target instanceof HTMLInputElement && event.target.matches('[data-policy-file]'))
    void importPolicy(event.target);
});
document.addEventListener('htmx:afterSwap', () => {
  revealActiveNavigation();
  document.querySelector<HTMLDialogElement>('#case-dialog')?.close();
});
document.addEventListener('htmx:sendError', () => {
  const error = document.querySelector<HTMLElement>('#network-error');
  if (error) {
    error.hidden = false;
    error.textContent = COPY.errors.NETWORK;
  }
});

document.addEventListener('htmx:beforeRequest', (event) => {
  if (
    event.target instanceof Element &&
    event.target.matches('[data-triage-refresh]') &&
    (document.activeElement?.matches('input,textarea,select') ||
      document.querySelector('dialog[open],details[open]'))
  )
    event.preventDefault();
});
