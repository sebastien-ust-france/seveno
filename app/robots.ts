import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const privateRoutes = ['/admin/', '/api/', '/candidat/', '/entreprise/', '/connexion', '/onboarding', '/recommandation/', '/invitation-entreprise/'];
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: privateRoutes,
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: ['/offres', '/offres/', '/talents', '/talents/'],
        disallow: privateRoutes,
      },
    ],
    sitemap: 'https://seveno.eu/sitemap.xml',
    host: 'https://seveno.eu',
  };
}
