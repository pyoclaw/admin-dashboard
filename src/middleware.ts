// SOURCE: snatched from developers.cloudflare.com/changelog/post/2026-08-14-workers-access (ctx.access)
// + developers.cloudflare.com/cloudflare-one/.../validating-json (jose fallback)
// Protects /admin* only. Edge Access enforces login; this is in-Worker defense-in-depth.
import { defineMiddleware } from "astro:middleware";
import { jwtVerify, createRemoteJWKSet } from "jose";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  if (!url.pathname.startsWith("/admin")) return next();

  const { env } = context.locals.runtime;
  const ctx = context.locals.runtime.ctx;

  // 1. Native ctx.access (Workers with Access enabled, 2026-08-14+). No jose needed.
  // ExecutionContext.access?: CloudflareAccessContext { aud, getIdentity() } — see worker-configuration.d.ts
  try {
    if (ctx.access) {
      const identity = await ctx.access.getIdentity();
      if (identity?.email) return next();
      return new Response("Access did not run / unauthenticated", { status: 401 });
    }
  } catch {
    /* fall through to JWT */
  }

  // 2. Local dev bypass: access.dev mock covers wrangler dev; SKIP_ACCESS for astro dev.
  if (env.SKIP_ACCESS === "true") return next();

  // 3. Manual JWT (custom domains / self-hosted apps).
  const token = context.request.headers.get("cf-access-jwt-assertion");
  if (!token || !env.TEAM_DOMAIN || !env.POLICY_AUD) {
    return new Response("Missing required CF Access JWT", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }
  try {
    const JWKS = createRemoteJWKSet(new URL(`${env.TEAM_DOMAIN}/cdn-cgi/access/certs`));
    await jwtVerify(token, JWKS, { issuer: env.TEAM_DOMAIN, audience: env.POLICY_AUD });
    return next();
  } catch {
    return new Response("Invalid Access JWT", { status: 403 });
  }
});
