import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/inbound(.*)",
  // Authenticated via requireApiKey() (Authorization: Bearer <key>) inside
  // each route handler, not a Clerk session — must bypass auth.protect()
  // here or every request gets redirected to /sign-in before it arrives.
  "/api/v1(.*)",
  "/site-report(.*)",  // public, token-authenticated (no Clerk session needed)
])

export const proxy = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
