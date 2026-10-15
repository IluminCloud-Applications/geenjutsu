export interface RecommendedApp {
  id: string;
  name: string;
  domain: string;
  url: string;
  tagline: string;
  taglineEn?: string;
  description: string;
  descriptionEn?: string;
  logo: string;
  fallbackIcon: string;
  badge?: string;
  badgeEn?: string;
}
