export interface AuthenticationContext {
  accessToken: string;
  identifier: string;
}

/**
 * Normalizes an OIDC subject identifier to an IRI.
 * Solid WebIDs are already IRIs; plain OIDC `sub` values (e.g. a username or UUID)
 * are prepended with the server-side base to match how the policy AS stores them.
 * Update this base when the server-side convention changes.
 */
const NON_IRI_IDENTIFIER_BASE = 'http://example.com/id/';
const IRI_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\S*$/;

export function normalizeIdentifierToIri(identifier: string): string {
  if (IRI_PATTERN.test(identifier)) {
    return identifier;
  }
  return `${NON_IRI_IDENTIFIER_BASE}${encodeURIComponent(identifier)}`;
}

let authContext: AuthenticationContext | undefined;

export function setAuthenticationContext(context: AuthenticationContext): void {
  authContext = {
    ...context,
    identifier: normalizeIdentifierToIri(context.identifier),
  };
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
