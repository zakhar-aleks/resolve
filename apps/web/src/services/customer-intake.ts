import { IntakeSchema } from '@resolve/contracts';
import { text } from '../helpers/forms';
import { supportApi } from './support-api';
import { errorMessage } from './workspace';
export async function customerIntake(
  request: Request,
): Promise<{ reference: string; error: string }> {
  if (request.method !== 'POST') return { reference: '', error: '' };
  try {
    const form = await request.formData();
    const input = IntakeSchema.parse({
      name: text(form, 'name'),
      title: text(form, 'title'),
      message: text(form, 'message'),
      aiPreference: text(form, 'aiPreference'),
    });
    return { reference: (await supportApi.intake(input)).reference, error: '' };
  } catch (error) {
    return { reference: '', error: errorMessage(error) };
  }
}
