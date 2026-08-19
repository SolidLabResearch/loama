export interface AuthenticationContext {
  accessToken: string;
  identifier: string;
}

let authContext: AuthenticationContext | undefined;

export function setAuthenticationContext(context: AuthenticationContext): void {
  authContext = context;
}

export function clearAuthenticationContext(): void {
  authContext = undefined;
}

function requireAuthenticationContext(): AuthenticationContext {
  if (!authContext) {
    throw new Error('User not logged in');
  }
  return authContext;
}

export function authenticatedFetch(url: string, options?: RequestInit): Promise<Response> {
  const { accessToken } = requireAuthenticationContext();
  const headers = new Headers(options?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(url, {
    ...options,
    headers,
  });
}

export function getLoggedInIdentifier(): string {
  return requireAuthenticationContext().identifier;
}
