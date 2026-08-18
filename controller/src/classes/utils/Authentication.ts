import { getDefaultSession } from '@inrupt/solid-client-authn-browser';

export function authenticatedFetch(url: string, options?: RequestInit): Promise<Response> {
  const webId = getDefaultSession().info.webId;
  if (!webId) {
    throw new Error('User not logged in');
  }
  options = {
    ...options,
    headers: {
      ...options?.headers,
      'Authorization': `WebID ${encodeURIComponent(webId)}`,
    },
  };
  return fetch(url, options);
}

export function getLoggedInIdentifier(): string {
  const webId = getDefaultSession().info.webId;
  if (!webId) {
    throw new Error('User not logged in');
  }
  return webId;
}
