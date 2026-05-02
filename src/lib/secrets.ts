interface AppSecrets {
  auth_secret: string;
  github_client_id: string;
  github_client_secret: string;
  google_ai_api_key: string;
}

let _secrets: AppSecrets | null = null;

function getSecrets(): AppSecrets {
  if (_secrets) return _secrets;

  const raw = process.env.APP_SECRETS;
  if (raw) {
    try {
      _secrets = JSON.parse(raw) as AppSecrets;
      return _secrets;
    } catch {
      console.error('Failed to parse APP_SECRETS JSON');
    }
  }

  _secrets = {
    auth_secret: process.env.AUTH_SECRET || '',
    github_client_id: process.env.GITHUB_CLIENT_ID || '',
    github_client_secret: process.env.GITHUB_CLIENT_SECRET || '',
    google_ai_api_key: process.env.GOOGLE_AI_API_KEY || '',
  };
  return _secrets;
}

export const secrets = {
  get authSecret() {
    return getSecrets().auth_secret;
  },
  get githubClientId() {
    return getSecrets().github_client_id;
  },
  get githubClientSecret() {
    return getSecrets().github_client_secret;
  },
  get googleAiApiKey() {
    return getSecrets().google_ai_api_key;
  },
};
