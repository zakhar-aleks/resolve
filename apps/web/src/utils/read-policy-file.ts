import { COPY } from '../consts/copy';
export async function readPolicyFile(file: File): Promise<string> {
  if (!/\.(txt|md)$/iu.test(file.name) || file.size > 50000)
    throw new Error(COPY.errors.POLICY_FILE);
  const text = await file.text();
  if (text.length > 10000) throw new Error(COPY.errors.POLICY_FILE);
  return text;
}
