import { NextRequest, NextResponse } from 'next/server';
import {
  SevenoGeographyError,
  listAdministrativeAreas,
  listCities,
  listSupportedEuropeanCountries,
} from '@/lib/seveno-geography-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const level = request.nextUrl.searchParams.get('level')?.trim() ?? 'countries';
    const countryCode = request.nextUrl.searchParams.get('countryCode')?.trim() ?? '';
    const administrativeAreaCode = request.nextUrl.searchParams.get('administrativeAreaCode')?.trim() ?? '';
    let options;

    if (level === 'countries') {
      options = await listSupportedEuropeanCountries();
    } else if (level === 'administrativeAreas') {
      options = await listAdministrativeAreas(countryCode);
    } else if (level === 'cities') {
      options = await listCities(countryCode, administrativeAreaCode);
    } else {
      throw new SevenoGeographyError('invalid_geography_level', 400, 'Le niveau géographique est invalide.');
    }

    return NextResponse.json(
      { options },
      { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } },
    );
  } catch (error) {
    const status = error instanceof SevenoGeographyError ? error.status : 500;
    return NextResponse.json(
      {
        error: error instanceof SevenoGeographyError ? error.code : 'geography_unavailable',
        message: error instanceof Error ? error.message : 'Le référentiel géographique est indisponible.',
      },
      { status },
    );
  }
}
