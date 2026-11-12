/** Pick the video the user most likely means: the largest visible one, preferring a playing one. */
export function findTargetVideo(doc: Document = document): HTMLVideoElement | null {
  const videos = Array.from(doc.querySelectorAll('video'));
  let best: HTMLVideoElement | null = null;
  let bestScore = 0;
  for (const v of videos) {
    const r = v.getBoundingClientRect();
    const visibleW = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const visibleH = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    let score = visibleW * visibleH;
    if (score < 80 * 45) continue; // ignore tiny / hidden previews
    if (!v.paused && !v.ended) score *= 2;
    if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) score *= 1.2;
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

/** Client rect of the element box, as a plain object. */
export function videoBox(v: HTMLVideoElement) {
  const r = v.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}
