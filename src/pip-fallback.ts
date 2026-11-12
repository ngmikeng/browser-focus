import type { Viewer } from './pip-viewer';
import type { ViewMode } from './storage';
import { toSource, type Zone } from './zone';

/**
 * Fallback for browsers without Document PiP: draw the zone into a canvas, stream it into a
 * hidden <video>, and put that video into classic Picture-in-Picture. Crop mode only, and no
 * custom controls; play/pause in the PiP window is forwarded to the source video.
 */
export class ClassicPipViewer implements Viewer {
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d', { alpha: false })!;
  private out = document.createElement('video');
  private raf = 0;
  private closed = false;

  private constructor(private video: HTMLVideoElement, private zone: Zone, private onClose: () => void) {}

  static supported() {
    return document.pictureInPictureEnabled && 'captureStream' in HTMLCanvasElement.prototype;
  }

  static async open(video: HTMLVideoElement, zone: Zone, onClose: () => void): Promise<ClassicPipViewer> {
    const v = new ClassicPipViewer(video, zone, onClose);
    v.draw();
    v.out.muted = true;
    v.out.srcObject = v.canvas.captureStream(30);
    await v.out.play();
    v.out.addEventListener('leavepictureinpicture', () => {
      if (v.closed) return;
      v.cleanup();
      v.onClose();
    });
    // forward PiP play/pause buttons to the real video
    v.out.addEventListener('pause', () => !v.closed && v.video.pause());
    v.out.addEventListener('play', () => v.video.paused && v.video.play());
    await v.out.requestPictureInPicture();
    v.loop();
    return v;
  }

  setZone(z: Zone) {
    this.zone = z;
  }

  setMode(_m: ViewMode) {
    /* caption mode is not available in classic PiP */
  }

  close() {
    if (this.closed) return;
    this.cleanup();
    if (document.pictureInPictureElement === this.out) document.exitPictureInPicture().catch(() => {});
  }

  private draw() {
    const v = this.video;
    if (!v.videoWidth) {
      this.canvas.width = 320;
      this.canvas.height = 90;
      return;
    }
    const s = toSource(this.zone, v.videoWidth, v.videoHeight);
    if (this.canvas.width !== s.width || this.canvas.height !== s.height) {
      this.canvas.width = s.width;
      this.canvas.height = s.height;
    }
    this.ctx.drawImage(v, s.left, s.top, s.width, s.height, 0, 0, s.width, s.height);
  }

  private loop = () => {
    if (this.closed) return;
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private cleanup() {
    this.closed = true;
    cancelAnimationFrame(this.raf);
    this.out.srcObject = null;
  }
}
