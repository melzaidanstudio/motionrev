import { InsufficientCreditError, cancelTalkingHeadNotes, getTalkingHead, queueTalkingHeadNotes } from "@/lib/db";
import { requireUser, sameOrigin } from "@/lib/auth";
import { priceFor } from "@/lib/settings";
import { enqueueTalkingHead } from "@/lib/talkingHead/queue";
import { canOpenEditor } from "@/lib/talkingHead/results";
import { openNotes } from "@/lib/talkingHead/notes";

/** Queue a round of work on the notes the user left in the motlab viewer for this video. */
export async function POST(req: Request, ctx: RouteContext<"/api/talking-heads/[id]/notes">) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const g = await requireUser();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const t = getTalkingHead(id);
  if (!t || (t.user_id !== g.user.id && g.user.role !== "admin")) {
    return Response.json({ error: "Video tidak ditemukan." }, { status: 404 });
  }
  if (t.status !== "done") return Response.json({ error: "Video ini masih diproses. Tunggu sampai selesai." }, { status: 409 });
  if (!canOpenEditor(t)) {
    return Response.json({ error: "Proyek motlab video ini sudah tidak lengkap, jadi catatannya tidak bisa dikerjakan." }, { status: 409 });
  }
  const n = openNotes(t);
  if (n === 0) return Response.json({ error: "Belum ada catatan terbuka. Tulis catatan dulu di editor motlab." }, { status: 409 });

  try {
    queueTalkingHeadNotes(id, t.user_id, priceFor(g.user));
  } catch (e) {
    if (e instanceof InsufficientCreditError) {
      return Response.json({ error: `Kredit tidak cukup. Saldo ${e.balance}, satu putaran catatan butuh ${e.price}.` }, { status: 402 });
    }
    throw e;
  }
  enqueueTalkingHead(id);
  return Response.json({ ok: true, notes: n });
}

/** Cancel a notes round that is still waiting in the queue. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/talking-heads/[id]/notes">) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const g = await requireUser();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const t = getTalkingHead(id);
  if (!t || (t.user_id !== g.user.id && g.user.role !== "admin")) {
    return Response.json({ error: "Video tidak ditemukan." }, { status: 404 });
  }
  if (t.pending_task !== "notes" || t.status !== "queued") {
    return Response.json({ error: "Catatan ini sudah mulai dikerjakan atau tidak ada di antrean." }, { status: 409 });
  }
  cancelTalkingHeadNotes(id);
  return Response.json({ ok: true });
}
