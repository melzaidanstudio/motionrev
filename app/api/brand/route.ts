import { z } from "zod";
import { requireUser, sameOrigin } from "@/lib/auth";
import { getBrandKit, saveBrandKit } from "@/lib/brandKit";

const Input = z.object({
  name: z.string().max(60),
  style: z.string().max(40).nullable(),
  palette: z.string().max(40),
  font: z.string().max(40),
});

export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  return Response.json({ brand: getBrandKit(g.user.id) });
}

export async function PUT(req: Request) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const g = await requireUser();
  if (g.error) return g.error;
  const p = Input.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: "Isian Brand Kit tidak valid." }, { status: 400 });
  const err = saveBrandKit(g.user.id, p.data);
  if (err) return Response.json({ error: err }, { status: 400 });
  return Response.json({ brand: getBrandKit(g.user.id) });
}
