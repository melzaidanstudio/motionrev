/**
 * The most CPU threads any one piece of work in motionrev may use: renders, the Claude Code tools they run, and the
 * ffmpeg steps of Bedah Video. Fixed by the owner at 4.
 */
export const MAX_THREADS = 4;

/** Environment that caps the thread pools of the numeric libraries tools use (whisper, numpy, torch, opencv). */
export function threadEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const n = String(MAX_THREADS);
  return {
    ...base,
    OMP_NUM_THREADS: n,
    MKL_NUM_THREADS: n,
    OPENBLAS_NUM_THREADS: n,
    NUMEXPR_MAX_THREADS: n,
    VECLIB_MAXIMUM_THREADS: n,
    OPENCV_FOR_THREADS_NUM: n,
    TORCH_NUM_THREADS: n,
  };
}

/** ffmpeg options that cap decoding and filtering threads; they go before the first input. */
export const FFMPEG_THREAD_ARGS = ["-threads", String(MAX_THREADS), "-filter_threads", String(MAX_THREADS)];
