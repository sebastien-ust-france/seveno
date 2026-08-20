import type { MetadataRoute } from 'next';
import { listPublicCandidatesServer } from '@/lib/seveno-public-candidates-server';
import { listPublicOffersServer } from '@/lib/seveno-public-offers-server';

export const revalidate = 300;

const publicPages = [
  '/',
  '/candidats',
  '/entreprises',
  '/entreprises/tarifs',
  '/observatoire',
  '/etude',
  '/a-propos',
  '/contact',
  '/mentions-legales',
  '/cgu',
  '/confidentialite',
  '/cookies',
  '/offres',
  '/talents',
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = publicPages.map((path, index) => ({
    url: `https://seveno.eu${path}`,
    changeFrequency: path === '/etude' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : index === 4 ? 0.9 : 0.8,
  }));

  try {
    const [offers, candidates] = await Promise.all([
      listPublicOffersServer(),
      listPublicCandidatesServer(),
    ]);
    return [
      ...staticEntries,
      ...offers.map((offer) => ({
        url: `https://seveno.eu/offres/${offer.slug}`,
        ...(offer.updatedAt ? { lastModified: new Date(offer.updatedAt) } : {}),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      })),
      ...candidates.map((candidate) => ({
        url: `https://seveno.eu/talents/${candidate.slug}`,
        ...(candidate.updatedAt ? { lastModified: new Date(candidate.updatedAt) } : {}),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    ];
  } catch (error) {
    console.error('[sitemap] Public discovery data unavailable', error);
    return staticEntries;
  }
}
