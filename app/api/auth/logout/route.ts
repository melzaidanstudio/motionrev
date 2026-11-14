import { endSession, sameOrigin } from "@/lib/auth";

export async function POST(req: Request) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  await endSession();
  return Response.json({ ok: true });
}
