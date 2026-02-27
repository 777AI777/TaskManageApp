function firstHeaderValue(value: string | null) {
  if (!value) {
    return null;
  }
  const [first] = value.split(",");
  const trimmed = first?.trim();
  return trimmed || null;
}

function toOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function resolveProto(request: Request) {
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  if (forwardedProto) {
    return forwardedProto;
  }
  const requestOrigin = toOrigin(request.url);
  if (requestOrigin) {
    try {
      return new URL(requestOrigin).protocol.replace(":", "");
    } catch {
      return null;
    }
  }
  return null;
}

function resolveEnvOrigin(envUrl: string | undefined) {
  const trimmed = envUrl?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "klocalhost") {
      parsed.hostname = "localhost";
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveInviteOrigin(request: Request, envUrl = process.env.NEXT_PUBLIC_APP_URL) {
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  if (forwardedHost && forwardedProto) {
    const forwardedOrigin = toOrigin(`${forwardedProto}://${forwardedHost}`);
    if (forwardedOrigin) {
      return forwardedOrigin;
    }
  }

  const host = firstHeaderValue(request.headers.get("host"));
  if (host) {
    const proto = resolveProto(request) ?? "https";
    const hostOrigin = toOrigin(`${proto}://${host}`);
    if (hostOrigin) {
      return hostOrigin;
    }
  }

  const envOrigin = resolveEnvOrigin(envUrl);
  if (envOrigin) {
    return envOrigin;
  }

  const requestOrigin = toOrigin(request.url);
  if (requestOrigin) {
    return requestOrigin;
  }

  return "http://localhost:3000";
}
