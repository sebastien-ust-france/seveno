import type { MetadataRoute } from 'next';

const publicPages = [
  '/',
  '/candidats',
  '/entreprises',
  '/observatoire',
  '/etude',
  '/a-propos',
  '/contact',
  '/mentions-legales',
  '/cgu',
  '/confidentialite',
  '/cookies',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.map((path, index) => ({
    url: `https://seveno.eu${path}`,
    changeFrequency: path === '/etude' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : index === 4 ? 0.9 : 0.8,
  }));
}
