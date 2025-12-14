import createMiddleware from 'next-intl/middleware';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

type CookieToSet = { name: string; value: string; options: CookieOptions };

const intlMiddleware = createMiddleware(routing);

// Protected paths requiring user authentication
const protectedPaths = ['/dashboard', '/generate', '/history', '/profile', '/credits', '/payment'];

// Admin paths requiring admin authentication
const adminPaths = ['/admin/dashboard', '/admin/settings'];

// Admin login is public but separate from user login
const adminLoginPath = '/admin/login';

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  const pathname = request.nextUrl.pathname;
  const pathnameWithoutLocale = pathname.replace(/^\/(de|en|fr)/, '');

  const isProtectedPath = protectedPaths.some((path) =>
    pathnameWithoutLocale.startsWith(path)
  );

  const isAdminPath = adminPaths.some((path) =>
    pathnameWithoutLocale.startsWith(path)
  );

  const isAdminLoginPath = pathnameWithoutLocale.startsWith(adminLoginPath);

  // Create Supabase client for auth checks
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Handle admin paths
  if (isAdminPath) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Not logged in, redirect to admin login
      const locale = pathname.split('/')[1] || routing.defaultLocale;
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/admin/login`;
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    const isAdmin = userData && (userData as { is_admin: boolean }).is_admin;
    if (userError || !isAdmin) {
      // User is not admin, redirect to admin login with error
      const locale = pathname.split('/')[1] || routing.defaultLocale;
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/admin/login`;
      url.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(url);
    }

    // User is authenticated and is admin, continue
    return response;
  }

  // Handle admin login path - redirect to dashboard if already authenticated as admin
  if (isAdminLoginPath) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      const isAdminUser = userData && (userData as { is_admin: boolean }).is_admin;
      if (isAdminUser) {
        // Already authenticated as admin, redirect to admin dashboard
        const locale = pathname.split('/')[1] || routing.defaultLocale;
        const url = request.nextUrl.clone();
        url.pathname = `/${locale}/admin/dashboard`;
        return NextResponse.redirect(url);
      }
    }

    // Not authenticated or not admin, show login page
    return response;
  }

  // Handle regular protected paths
  if (isProtectedPath) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const locale = pathname.split('/')[1] || routing.defaultLocale;
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
