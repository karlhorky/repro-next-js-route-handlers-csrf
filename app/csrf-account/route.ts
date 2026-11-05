import { randomUUID } from 'node:crypto';

const accounts = new Map<string, { displayName: string }>();

export async function PUT(request: Request) {
  const body = await request.json();

  if (
    body.username !== 'victim' ||
    body.password !== 'demo-password' ||
    !['Lax', 'None'].includes(body.sameSite)
  ) {
    return Response.json({ error: 'Invalid demo credentials or cookie mode' }, { status: 400 });
  }

  const token = randomUUID();
  accounts.set(token, { displayName: 'Original name' });

  return Response.json(
    { account: { displayName: 'Original name' }, sameSite: body.sameSite },
    {
      headers: {
        'Set-Cookie': `csrfDemoSession=${token}; HttpOnly; Secure; SameSite=${body.sameSite}; Path=/`,
      },
    },
  );
}

export function GET(request: Request) {
  const token = request.headers.get('cookie')?.match(/(?:^|; )csrfDemoSession=([a-f0-9-]+)(?:;|$)/)?.[1];
  const account = token && accounts.get(token);

  if (!account) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  return Response.json({ account });
}

export async function POST(request: Request) {
  const body = await request.json();
  const token = request.headers.get('cookie')?.match(/(?:^|; )csrfDemoSession=([a-f0-9-]+)(?:;|$)/)?.[1];
  const account = token && accounts.get(token);

  if (!account) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (typeof body.displayName !== 'string') {
    return Response.json({ error: 'Display name must be a string' }, { status: 400 });
  }

  account.displayName = body.displayName;

  return Response.json({
    account,
    request: {
      origin: request.headers.get('origin'),
      contentType: request.headers.get('content-type'),
      fetchSite: request.headers.get('sec-fetch-site'),
      sessionCookieReceived: true,
    },
  });
}
