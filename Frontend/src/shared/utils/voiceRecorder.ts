// Small wrapper around the browser MediaRecorder API for recording voice
// notes. Used by both the client and lawyer chat composers.
//
// Usage:
//   const rec = createVoiceRecorder();
//   await rec.start();              // asks for mic permission, begins recording
//   ...
//   const { blob, durationSeconds, mimeType } = await rec.stop();  // sends
//   // or rec.cancel() to discard
//
// We resolve the blob with the recorder's OWN mimeType (e.g. "audio/webm")
// rather than hard-coding "audio/mp3" — Chrome/Firefox actually produce webm,
// and the backend allow-list + the <audio> player both rely on the true type.

export interface VoiceRecording {
  blob: Blob;
  durationSeconds: number;
  mimeType: string;
  // True when the mic produced essentially no sound for the whole recording
  // (muted / wrong device) — lets the UI warn instead of sending a silent clip.
  silent: boolean;
}

export interface VoiceRecorderHandle {
  start: () => Promise<void>;
  stop: () => Promise<VoiceRecording>;
  cancel: () => void;
  isRecording: () => boolean;
}

// Pick a recording format the browser actually supports. Some browsers
// silently produce a broken/empty file when handed an unsupported (or no)
// mimeType, so we probe a short list and fall back to the browser default.
function pickSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported) {
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
  }
  return "";
}

// Below this peak amplitude (0–127 scale from the analyser) for the WHOLE
// recording, we treat it as "no sound captured". Real speech easily exceeds
// this; it's set low to avoid false positives.
const SILENCE_PEAK_THRESHOLD = 2;

// Hard cap on a single voice note (seconds). The chat composers auto-stop and
// send the recording once it reaches this length, so neither a client nor a
// lawyer can record indefinitely. Keep the client and lawyer composers in sync
// by importing this constant rather than hard-coding a number.
export const MAX_VOICE_DURATION_SECONDS = 120;

export function createVoiceRecorder(): VoiceRecorderHandle {
  let mediaRecorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: BlobPart[] = [];
  let startedAt = 0;

  // Live input-level monitoring (to detect a dead/muted mic).
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let rafId: number | null = null;
  let peakLevel = 0;

  const stopLevelMonitor = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    analyser = null;
  };

  const startLevelMonitor = (src: MediaStream) => {
    try {
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(src);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const sample = () => {
        if (!analyser) return;
        analyser.getByteTimeDomainData(data);
        let max = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = Math.abs(data[i] - 128); // 128 = silence midpoint
          if (v > max) max = v;
        }
        if (max > peakLevel) peakLevel = max;
        rafId = requestAnimationFrame(sample);
      };
      sample();
    } catch {
      // Monitoring is best-effort — never block recording on it.
    }
  };

  const cleanup = () => {
    stopLevelMonitor();
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    mediaRecorder = null;
    chunks = [];
  };

  return {
    isRecording: () => mediaRecorder?.state === "recording",

    async start() {
      // autoGainControl boosts a quiet mic; echo/noise suppression clean it
      // up. These also nudge the browser toward a real capture device.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      chunks = [];
      peakLevel = 0;
      const mimeType = pickSupportedMimeType();
      mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      startedAt = Date.now();
      startLevelMonitor(stream);
      // Timeslice (250ms): collect audio in small chunks instead of one shot,
      // which is far more reliable than a single buffer flushed at stop().
      mediaRecorder.start(250);
    },

    stop() {
      return new Promise<VoiceRecording>((resolve, reject) => {
        const recorder = mediaRecorder;
        if (!recorder) {
          reject(new Error("Not recording"));
          return;
        }
        const mimeType = recorder.mimeType || "audio/webm";
        const silent = peakLevel < SILENCE_PEAK_THRESHOLD;
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const durationSeconds = Math.max(
            1,
            Math.round((Date.now() - startedAt) / 1000)
          );
          cleanup();
          resolve({ blob, durationSeconds, mimeType, silent });
        };
        recorder.stop();
      });
    },

    cancel() {
      const recorder = mediaRecorder;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = () => cleanup();
        try {
          recorder.stop();
        } catch {
          cleanup();
        }
      } else {
        cleanup();
      }
    },
  };
}

// "0:07" / "1:23" — formats elapsed seconds for the recording indicator and
// the voice-note duration label.
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
