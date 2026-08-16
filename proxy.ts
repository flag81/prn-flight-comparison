import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';

// Fixed-length hash comparison avoids leaking credential length via timing.
function safeCompare(a: string, b: string): boolean {
  const aHash = createHash('sha256').update(a).digest();
  const bHash = createHash('sha256').update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

const UNAUTHORIZED = new NextResponse('Authentication required', {
  status: 401,
  headers: { 'WWW-Authenticate': 'Basic realm="prn-flight-comparison", charset="UTF-8"' },
});

export function proxy(request: NextRequest) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;

  // Auth is disabled when credentials aren't configured (e.g. local dev).
  if (!expectedUser || !expectedPassword) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const separatorIndex = decoded.indexOf(':');
    const user = separatorIndex === -1 ? decoded : decoded.slice(0, separatorIndex);
    const password = separatorIndex === -1 ? '' : decoded.slice(separatorIndex + 1);

    if (safeCompare(user, expectedUser) && safeCompare(password, expectedPassword)) {
      return NextResponse.next();
    }
  }

  return UNAUTHORIZED;
}

export const config = {
  // Skip static assets so a bad/missing prompt never blocks CSS/JS/images.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
