/** Runs once when the server starts: resume Talking Head jobs that were waiting. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return; // no renders while building
  const { bootTalkingHeads } = await import("./lib/talkingHead/queue");
  bootTalkingHeads();
}
