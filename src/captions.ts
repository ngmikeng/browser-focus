/** A source of subtitle text for caption mode. */
export interface CaptionSource {
  readonly name: string;
  /** Called with the current caption lines ([] when nothing is on screen). */
  start(onText: (lines: string[]) => void): void;
  stop(): void;
}

/**
 * YouTube draws closed captions as DOM above the video (not in the pixels):
 * .ytp-caption-window-container > .caption-window > .captions-text > .caption-visual-line > .ytp-caption-segment
 */
export class YouTubeCaptions implements CaptionSource {
  readonly name = 'YouTube CC';
  private observer?: MutationObserver;
  private last = '';

  constructor(private player: Element) {}

  static detect(video: HTMLVideoElement): YouTubeCaptions | null {
    const player = video.closest('.html5-video-player');
    return player ? new YouTubeCaptions(player) : null;
  }

  start(onText: (lines: string[]) => void) {
    const emit = () => {
      const lines = Array.from(this.player.querySelectorAll('.caption-visual-line'))
        .map((line) =>
          Array.from(line.querySelectorAll('.ytp-caption-segment'))
            .map((s) => s.textContent ?? '')
            .join('')
            .trim(),
        )
        .filter(Boolean);
      // fall back to bare segments if YouTube changes the line wrapper
      const out = lines.length
        ? lines
        : Array.from(this.player.querySelectorAll('.ytp-caption-segment'))
            .map((s) => s.textContent?.trim() ?? '')
            .filter(Boolean);
      const joined = out.join('\n');
      if (joined !== this.last) {
        this.last = joined;
        onText(out);
      }
    };
    this.observer = new MutationObserver(emit);
    this.observer.observe(this.player, { childList: true, subtree: true, characterData: true });
    emit();
  }

  stop() {
    this.observer?.disconnect();
  }
}

/** Standard <track> subtitles (WebVTT) on any site. */
export class TextTrackCaptions implements CaptionSource {
  readonly name = 'Subtitles track';
  private track?: TextTrack;
  private prevMode?: TextTrackMode;
  private handler?: () => void;

  constructor(private video: HTMLVideoElement) {}

  static detect(video: HTMLVideoElement): TextTrackCaptions | null {
    const tracks = Array.from(video.textTracks);
    return tracks.some((t) => t.kind === 'subtitles' || t.kind === 'captions')
      ? new TextTrackCaptions(video)
      : null;
  }

  start(onText: (lines: string[]) => void) {
    const tracks = Array.from(this.video.textTracks).filter(
      (t) => t.kind === 'subtitles' || t.kind === 'captions',
    );
    this.track = tracks.find((t) => t.mode === 'showing') ?? tracks[0];
    if (!this.track) return;
    this.prevMode = this.track.mode;
    if (this.track.mode === 'disabled') this.track.mode = 'hidden'; // load cues without drawing them
    this.handler = () => {
      const cues = Array.from(this.track?.activeCues ?? []) as VTTCue[];
      onText(
        cues
          .flatMap((c) => (c.text ?? '').replace(/<[^>]+>/g, '').split('\n'))
          .map((s) => s.trim())
          .filter(Boolean),
      );
    };
    this.track.addEventListener('cuechange', this.handler);
    this.handler();
  }

  stop() {
    if (this.track && this.handler) this.track.removeEventListener('cuechange', this.handler);
    if (this.track && this.prevMode) this.track.mode = this.prevMode;
  }
}

export function detectCaptions(video: HTMLVideoElement): CaptionSource | null {
  return YouTubeCaptions.detect(video) ?? TextTrackCaptions.detect(video);
}
