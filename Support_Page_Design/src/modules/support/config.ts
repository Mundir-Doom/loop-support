function getEnv(name: string, fallback?: string): string {
  const value = import.meta.env[name as keyof ImportMetaEnv];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Missing environment variable ${name}`);
}

const apiBaseUrl = getEnv("VITE_API_BASE_URL");
const defaultCategory = getEnv("VITE_SUPPORT_DEFAULT_CATEGORY", "General");

export const supportConfig = {
  apiBaseUrl,
  defaultCategory
};
