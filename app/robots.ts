import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/candidat/', '/entreprise/', '/connexion', '/onboarding', '/recommandation/'],
      },
    ],
    sitemap: 'https://seveno.eu/sitemap.xml',
    host: 'https://seveno.eu',
  };
}
