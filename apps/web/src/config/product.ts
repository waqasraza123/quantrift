export const defaultProductName = "QuantRift";
export const defaultProductDescription =
  "QuantRift — Agentic AI platform for quantitative market intelligence, signal analysis, and evidence-based research.";
export const defaultSiteUrl = "https://quantrift.vercel.app";
export const defaultRepositoryUrl =
  "https://github.com/waqasraza123/quantrift";

export type ProductConfig = {
  name: string;
  description: string;
  siteUrl: string;
  repositoryUrl: string;
};

export function getProductConfig(): ProductConfig {
  const repositoryUrl = normalizeUrl(
    process.env.NEXT_PUBLIC_REPOSITORY_URL,
    defaultRepositoryUrl,
  );

  return {
    name: process.env.NEXT_PUBLIC_APP_NAME?.trim() || defaultProductName,
    description: defaultProductDescription,
    siteUrl: normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL, defaultSiteUrl),
    repositoryUrl,
  };
}

function normalizeUrl(value: string | undefined, fallback: string): string {
  const candidate = value?.trim() || fallback;
  try {
    return new URL(candidate).toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}
