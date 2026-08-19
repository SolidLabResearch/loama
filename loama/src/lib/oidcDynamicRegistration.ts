export interface DynamicRegistrationOptions {
  issuer: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  clientName: string;
}

interface OidcMetadata {
  registration_endpoint?: string;
}

interface RegistrationResponse {
  client_id?: string;
}

function cacheKey(issuer: string, redirectUri: string, postLogoutRedirectUri: string): string {
  return `loama.oidc.dynamic-client.${issuer}|${redirectUri}|${postLogoutRedirectUri}`;
}

function loadCachedClientId(issuer: string, redirectUri: string, postLogoutRedirectUri: string): string | undefined {
  const key = cacheKey(issuer, redirectUri, postLogoutRedirectUri);
  return window.localStorage.getItem(key) ?? undefined;
}

function saveCachedClientId(issuer: string, redirectUri: string, postLogoutRedirectUri: string, clientId: string): void {
  const key = cacheKey(issuer, redirectUri, postLogoutRedirectUri);
  window.localStorage.setItem(key, clientId);
}

export async function getOrRegisterDynamicClient(options: DynamicRegistrationOptions): Promise<string> {
  const { issuer, redirectUri, postLogoutRedirectUri, clientName } = options;

  const cached = loadCachedClientId(issuer, redirectUri, postLogoutRedirectUri);
  if (cached) return cached;

  const metadataResponse = await fetch(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`);
  if (!metadataResponse.ok) {
    throw new Error(`Failed to fetch OIDC metadata (${metadataResponse.status}).`);
  }

  const metadata = (await metadataResponse.json()) as OidcMetadata;
  if (!metadata.registration_endpoint) {
    throw new Error('OIDC provider has no dynamic registration endpoint. Configure a static client ID instead.');
  }

  const registrationResponse = await fetch(metadata.registration_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_name: clientName,
      application_type: 'web',
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      redirect_uris: [redirectUri],
      post_logout_redirect_uris: [postLogoutRedirectUri],
    }),
  });

  if (!registrationResponse.ok) {
    const errorBody = await registrationResponse.text();
    throw new Error(`Dynamic registration failed (${registrationResponse.status}): ${errorBody}`);
  }

  const registration = (await registrationResponse.json()) as RegistrationResponse;
  if (!registration.client_id) {
    throw new Error('Dynamic registration did not return a client_id.');
  }

  saveCachedClientId(issuer, redirectUri, postLogoutRedirectUri, registration.client_id);
  return registration.client_id;
}
