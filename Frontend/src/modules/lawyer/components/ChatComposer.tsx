import { Send, Paperclip, Mic, X, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  createVoiceRecorder,
  formatDuration,
  MAX_VOICE_DURATION_SECONDS,
  type VoiceRecorderHandle,
} from "../../../shared/utils/voiceRecorder";

interface ChatComposerProps {
  disabled?: boolean;
  onSend: (text: string) => void;
  // Upload one or more documents. Called when the user hits Send with files
  // attached. Returns a promise so the composer could await if needed.
  onSendFiles?: (files: File[]) => void | Promise<void>;
  // Send a recorded voice note.
  onSendVoice?: (
    blob: Blob,
    durationSeconds: number,
    mimeType: string
  ) => void | Promise<void>;
  // Fired when the user starts (true) / pauses (false) typing, for the live
  // "…typing" indicator.
  onTyping?: (isTyping: boolean) => void;
  // Quoted-reply bar: preview of the message being replied to (null = none).
  replyPreview?: string | null;
  onCancelReply?: () => void;
}

export default function ChatComposer({
  disabled,
  onSend,
  onSendFiles,
  onSendVoice,
  onTyping,
  replyPreview,
  onCancelReply,
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording state.
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const recorderRef = useRef<VoiceRecorderHandle | null>(null);
  const timerRef = useRef<number | null>(null);
  // Latest stopAndSend, so the recording-cap timer can auto-send without a
  // stale closure. Updated each render below.
  const stopAndSendRef = useRef<() => void>(() => {});

  // Typing-indicator throttle: emit true on first keystroke, then false after
  // a short idle gap, rather than on every keystroke.
  const typingActiveRef = useRef(false);
  const typingIdleRef = useRef<number | null>(null);

  const stopTyping = () => {
    if (typingIdleRef.current) {
      window.clearTimeout(typingIdleRef.current);
      typingIdleRef.current = null;
    }
    if (typingActiveRef.current) {
      typingActiveRef.current = false;
      onTyping?.(false);
    }
  };

  const handleTyping = () => {
    if (!onTyping) return;
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      onTyping(true);
    }
    if (typingIdleRef.current) window.clearTimeout(typingIdleRef.current);
    typingIdleRef.current = window.setTimeout(() => {
      typingActiveRef.current = false;
      typingIdleRef.current = null;
      onTyping(false);
    }, 1500);
  };

  // Clean up a dangling recording / timer if the composer unmounts.
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (typingIdleRef.current) window.clearTimeout(typingIdleRef.current);
      recorderRef.current?.cancel();
    };
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const submit = () => {
    const value = text.trim();
    if (!value && selectedFiles.length === 0) return;

    stopTyping();

    if (value) {
      onSend(value);
      setText("");
    }
    if (selectedFiles.length > 0 && onSendFiles) {
      void onSendFiles(selectedFiles);
      setSelectedFiles([]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const recorder = createVoiceRecorder();
      await recorder.start();
      recorderRef.current = recorder;
      setElapsed(0);
      setRecording(true);
      let seconds = 0;
      timerRef.current = window.setInterval(() => {
        seconds += 1;
        setElapsed(seconds);
        if (seconds >= MAX_VOICE_DURATION_SECONDS) {
          // Cap reached — stop the ticker and auto-send so a voice note can't
          // grow indefinitely.
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          stopAndSendRef.current();
        }
      }, 1000);
    } catch (err) {
      console.error("Microphone error:", err);
      alert(
        "Couldn't access the microphone. Please allow microphone permission and try again."
      );
    }
  };

  const cancelRecording = () => {
    stopTimer();
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setRecording(false);
    setElapsed(0);
  };

  const stopAndSend = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    stopTimer();
    setRecording(false);
    setSendingVoice(true);
    try {
      const result = await recorder.stop();
      if (result.silent) {
        alert(
          "We couldn't hear anything from your microphone — the recording was empty. Make sure your mic is unmuted and the correct device is selected, then try again."
        );
      } else if (onSendVoice && result.blob.size > 0) {
        await onSendVoice(result.blob, result.durationSeconds, result.mimeType);
      }
    } catch (err) {
      console.error("Voice send error:", err);
    } finally {
      recorderRef.current = null;
      setElapsed(0);
      setSendingVoice(false);
    }
  };

  // Keep the cap timer's reference to the latest stopAndSend.
  stopAndSendRef.current = stopAndSend;

  return (
    <div className="bg-white px-5 sm:px-8 py-3 border-t-2 border-gray-300">
      {/* Reply bar */}
      {replyPreview && !recording && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-4 border-[#01411C] bg-gray-50 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#01411C]">
              Replying to
            </p>
            <p className="truncate text-sm text-gray-600">{replyPreview}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-gray-500 hover:text-red-500 transition"
            title="Cancel reply"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* File Preview */}
      {selectedFiles.length > 0 && !recording && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-white px-3 py-2 rounded-lg text-sm border-2 border-gray-300"
            >
              <span className="truncate text-gray-700 font-medium">{file.name}</span>
              <button
                onClick={() => removeFile(index)}
                className="text-gray-500 hover:text-red-500 transition"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-center gap-3">
        {recording ? (
          <>
            <span className="flex flex-1 items-center gap-2 rounded-lg border-2 border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              Recording… {formatDuration(elapsed)} /{" "}
              {formatDuration(MAX_VOICE_DURATION_SECONDS)}
            </span>
            <button
              type="button"
              onClick={cancelRecording}
              title="Cancel recording"
              className="text-gray-600 hover:text-red-600 transition flex-shrink-0 hover:bg-gray-100 p-2 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={stopAndSend}
              title="Send voice message"
              className="rounded-lg bg-[#01411C] text-white p-2.5 hover:bg-green-900 transition flex-shrink-0 shadow-sm"
            >
              <Send className="h-5 w-5" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="text-gray-600 hover:text-[#01411C] transition flex-shrink-0 hover:bg-gray-100 p-2 rounded-lg disabled:opacity-50"
              title="Attach file"
              disabled={disabled || sendingVoice}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-5 w-5" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />

            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                handleTyping();
              }}
              placeholder="Type a message..."
              className="flex-1 rounded-lg border-2 border-gray-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#01411C]/30 focus:border-[#01411C] bg-white"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              disabled={disabled || sendingVoice}
            />

            {onSendVoice && (
              <button
                type="button"
                className="text-gray-600 hover:text-[#01411C] transition flex-shrink-0 hover:bg-gray-100 p-2 rounded-lg disabled:opacity-50"
                title="Record voice message"
                disabled={disabled || sendingVoice}
                onClick={startRecording}
              >
                {sendingVoice ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={disabled || sendingVoice || (!text.trim() && selectedFiles.length === 0)}
              className="rounded-lg bg-[#01411C] text-white p-2.5 hover:bg-green-900 transition disabled:opacity-50 flex-shrink-0 shadow-sm hover:shadow-md"
            >
              <Send className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
