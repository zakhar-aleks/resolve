import { profile, invite, cookieName, team, removeMember, apiKeys } from './auth';
import { text } from '../helpers/forms';
export async function accountModel(request: Request, token: string) {
  const account = await profile(token);
  let result: { url: string; delivered: boolean } | null = null;
  let keys: { intake: string; reviewer: string } | null = null;
  let error = false;
  if (request.method === 'POST') {
    try {
      const form = await request.formData();
      if (text(form, 'action') === 'remove') await removeMember(token, text(form, 'userId'));
      else if (text(form, 'action') === 'keys') keys = await apiKeys(token);
      else result = await invite(token, text(form, 'email'), text(form, 'role'));
    } catch {
      error = true;
    }
  }
  return {
    account,
    result,
    error,
    keys,
    members: account.role === 'owner' ? await team(token) : [],
  };
}
export { cookieName };
