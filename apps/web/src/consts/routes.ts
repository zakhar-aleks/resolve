export const ROUTES = {
  home: '/',
  workspace: '/fragments/workspace',
  actions: '/actions',
  mistralConsole: 'https://console.mistral.ai',
} as const;
export const VIEWS = ['support', 'company', 'connections'] as const;
export type View = (typeof VIEWS)[number];
