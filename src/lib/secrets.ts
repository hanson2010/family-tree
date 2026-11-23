// Secrets come from the APP_SECRETS JSON object when it is set, otherwise from
// environment variables. Both use the same names. (OAuth client IDs are not secrets; they are the
// GOOGLE_CLIENT_ID and GITHUB_CLIENT_ID settings.)
type SecretName = 'AUTH_SECRET' | 'GOOGLE_CLIENT_SECRET' | 'GITHUB_CLIENT_SECRET' | 'GOOGLE_AI_API_KEY';

let _appSecrets: Partial<Record<SecretName, string>> | null | undefined;

function getSecret(name: SecretName): string {
  if (_appSecrets === undefined) {
    _appSecrets = null;
    const raw = process.env.APP_SECRETS;
    if (raw) {
      try {
        _appSecrets = JSON.parse(raw);
      } catch {
        console.error('Failed to parse APP_SECRETS JSON');
      }
    }
  }

  return (_appSecrets ? _appSecrets[name] : process.env[name]) || '';
}

export const secrets = {
  get authSecret() {
    return getSecret('AUTH_SECRET');
  },
  get googleClientSecret() {
    return getSecret('GOOGLE_CLIENT_SECRET');
  },
  get githubClientSecret() {
    return getSecret('GITHUB_CLIENT_SECRET');
  },
  get googleAiApiKey() {
    return getSecret('GOOGLE_AI_API_KEY');
  },
};
