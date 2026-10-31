import { COPY } from '../consts/copy';
import { readPolicyFile } from '../utils/read-policy-file';
export async function importPolicy(input: HTMLInputElement): Promise<void> {
  const file = input.files?.[0];
  if (!file) return;
  const error = document.querySelector('[data-file-error]');
  try {
    const text = await readPolicyFile(file);
    const documentInput = document.querySelector<HTMLTextAreaElement>('#policy-document');
    if (documentInput) {
      documentInput.value = text;
      documentInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (error) error.textContent = '';
  } catch {
    if (error) error.textContent = COPY.errors.POLICY_FILE;
  }
  input.value = '';
}
