function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

export function getApiBaseUrl(options = {}) {
  const { required = true } = options;
  const value = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL);

  if (!value && required) {
    throw new Error(
      "EXPO_PUBLIC_API_URL is required. Copy .env.example to .env and set the backend base URL before starting Expo."
    );
  }

  return value;
}

export { normalizeBaseUrl };
