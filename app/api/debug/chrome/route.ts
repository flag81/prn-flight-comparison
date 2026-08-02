import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Chrome debug endpoint is no longer used. Scrapers now use Playwright directly.',
  });
}
