import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function protectedPath(pathname: string) {
  return pathname.startsWith("/u") || pathname.startsWith("/w");
}

function authPage(pathname: string) {
  return pathname === "/login" || pathname === "/signup";
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const nextParam = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  type CookieToApply = {
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  };
  let cookiesToApply: CookieToApply[] = [];

  function applyCookies(targetResponse: NextResponse) {
    cookiesToApply.forEach(({ name, value, options }) => {
      targetResponse.cookies.set(name, value, options);
    });
    return targetResponse;
  }

  // Only run auth checks for pages that actually require login routing behavior.
  if (!protectedPath(path) && !authPage(path)) {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToApply = cookiesToSet;
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && protectedPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", nextParam);
    return applyCookies(NextResponse.redirect(url));
  }

  if (user && authPage(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/u/me/boards";
    return applyCookies(NextResponse.redirect(url));
  }

  return applyCookies(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
