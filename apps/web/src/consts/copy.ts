import { WORKFLOWS_COPY } from './copy/workflows';
import { PRODUCT_COPY } from './copy/product';
import { PRIVACY_COPY } from './copy/privacy';
import { SHELL_COPY } from './copy/shell';
import { SUPPORT_COPY } from './copy/support';
import { COMPANY_COPY } from './copy/company';
import { CONNECTIONS_COPY } from './copy/connections';
import { FEEDBACK_COPY } from './copy/feedback';
export const COPY = {
  ...SHELL_COPY,
  ...PRODUCT_COPY,
  ...WORKFLOWS_COPY,
  ...PRIVACY_COPY,
  ...SUPPORT_COPY,
  ...COMPANY_COPY,
  ...CONNECTIONS_COPY,
  ...FEEDBACK_COPY,
} as const;
