# Authentication session audit

The branch starts at origin/main f0617ff7d9615ffb4a1f64a96fd72402e3153eca.

## Cookies and logout

Browser code does not read HttpOnly cookies: it sends same-origin fetch requests
with credentials. Route handlers, middleware and server helpers read cookies on
the server. Dorella tokens are excluded from successful browser JSON responses;
Express continues returning them to the Next.js server to set the cookies.
Successful auth responses use Cache-Control: no-store.

Access cookies use Path=/, refresh cookies use Path=/api/auth/refresh, HttpOnly,
SameSite=Strict and Secure in production. Deletion preserves the cookie scope and
flags and explicitly sends both Max-Age=0 and Expires in the past. The legacy
refresh cookie at Path=/ is also deleted with its historical SameSite=Lax policy.
No Domain is set on creation or deletion. Cookie identity is name/domain/path;
SameSite does not create a separate cookie identity.

DELETE /api/auth/refresh only delegates to logout: it cannot mint tokens, accepts
no user/token identifier in the request body, and revokes only the supplied refresh
cookie through Express. It rejects a mismatched Origin or cross-site Fetch
Metadata before any backend request or cookie mutation. Missing credentials are
an idempotent no-op; requiring a valid access JWT would break expired-session logout.
Strict cookies and the absence of cross-origin CORS opt-in also prevent browsers
from sending credentialed cross-origin DELETE requests. Non-browser clients with
no Origin remain supported and must possess the token to revoke it.

## Renewal and OAuth

Login, register, refresh, forgot-password and reset-password never initiate an
automatic refresh in response to a 401. OAuth and logout are excluded as well.
INVALID_CREDENTIALS keeps its API code and message. Protected requests retry once;
refresh failure invalidates a session once. The timer uses the same single-flight
promise. Cookie-writing login/register/Google/logout transitions are serialized
with refresh to prevent a stale response overwriting a new session's cookies.
Single-flight is per JavaScript context, not a cross-tab lock; the backend rejects
a second consumption of the same token with a controlled 401.

Google's Supabase redirect/code exchange and backend identity validation are
unchanged. The Dorella cookie is issued by a same-origin fetch after the callback
has obtained the Supabase token, so SameSite=Strict does not prevent the callback
from creating the new Dorella session. No browser consumer needs JWTs in JSON.

## jose warning and Cloudflare

Next.js reports CompressionStream/DecompressionStream from jose's public barrel
through its JWE compression module (node_modules/jose/dist/webapi/lib/deflate.js).
These constructors are inside compress/decompress functions, not executed at
module initialization. Dorella imports jwtVerify in src/middleware.ts and
src/lib/dal.ts. Both verify HS256 signed JWS tokens through compactVerify, not JWE
decryption; repository search finds no JWE or compression call in application code.
The middleware gates /admin and the protected shopping routes; dal verifies
server-side sessions. Neither path calls the warned functions.

Cloudflare Workers also supports both compression stream APIs, including
'deflate-raw': https://developers.cloudflare.com/workers/runtime-apis/web-standards/
The jwtVerify contract is JWS validation:
https://github.com/panva/jose/blob/main/docs/jwt/verify/functions/jwtVerify.md
The application uses OpenNext's Cloudflare worker with nodejs_compat in
wrangler.jsonc, not a Vercel deployment. The warning therefore does not identify
an unsupported operation on a current Dorella authentication execution path.
No jose version/import/dependency change is necessary. This is a source/runtime
compatibility audit, not a live Cloudflare deployment verification.

## Validation limits

The auth tests exercise the HTTP routes, cookie headers, React UI and explicit
concurrency barriers with Prisma/Supabase/fetch mocks. They do not authenticate a
real Google account or connect to PostgreSQL. Existing DB-backed inventory tests
remain opt-in. No deployment, database migration or Railway variable change is
part of this branch.
