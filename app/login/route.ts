export async function POST(request: Request) {
  const body = await request.json();

  if (
    !['victim', 'attacker'].includes(body.username) ||
    body.password !== 'demo-password'
  ) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  return Response.json(
    {
      user: body.username,
      origin: request.headers.get('origin'),
      contentType: request.headers.get('content-type'),
      fetchSite: request.headers.get('sec-fetch-site'),
      receivedCookie: request.headers.get('cookie'),
    },
    {
      headers: {
        'Set-Cookie': `demoSession=${body.username}; HttpOnly; SameSite=Lax; Secure; Path=/`,
      },
    },
  );
}
