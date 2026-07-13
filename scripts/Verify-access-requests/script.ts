import { getDefaultAuth, configureDefaultAuth } from "trustflows-client";

async function runClientCredentialsFlow() {
  configureDefaultAuth({
    persistTokens: false, 
  });

  const auth = getDefaultAuth();

  try {
    console.log("Authenticating via Client Credentials...");
    
    await auth.loginClientCredentials(
      "http://localhost:3000/alice/profile/card#me",  // Your WebID
      "alice@example.org",                            // Account email
      "abc123"                                        // Account password
    );

    console.log("Authentication successful.");

    const authFetch = auth.createAuthFetch();
    
    const targetUrl = "http://localhost:3000/bob/README";
    console.log(`Fetching: ${targetUrl}`);
    
    const response = await authFetch(targetUrl);
    const data = await response.text();
    
    console.log("Response status:", response.status);
    console.log("Data payload:", data);

  } catch (error) {
    console.error("Execution failed:", error);
  }
}

runClientCredentialsFlow();