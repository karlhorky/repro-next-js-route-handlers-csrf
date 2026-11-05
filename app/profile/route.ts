export function GET(request: Request) {
  const session = request.headers.get('cookie')?.match(/(?:^|; )demoSession=(victim|attacker)(?:;|$)/)?.[1];
  return Response.json({ user: session ?? null });
}
