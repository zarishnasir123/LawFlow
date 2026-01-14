/**
 * Voice Message utilities
 * Handles voice message recording and sending
 */

export interface VoiceMessageConfig {
  threadId: string;
  duration: number; // in seconds
  audioBlob: Blob;
}

export const recordVoiceMessage = async (): Promise<Blob | null> => {
  // Mock implementation - in production, use MediaRecorder API
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks: BlobPart[] = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/mp3" });
        resolve(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();

      // Stop recording after 60 seconds (max)
      setTimeout(() => mediaRecorder.stop(), 60000);
    });
  } catch (error) {
    console.error("Error accessing microphone:", error);
    return null;
  }
};

export const sendVoiceMessage = async (
  config: VoiceMessageConfig
): Promise<boolean> => {
  // Mock implementation - in production, upload to server
  console.log("Voice message being sent:", {
    threadId: config.threadId,
    duration: config.duration,
    size: config.audioBlob.size,
  });

  return true;
};

export const playVoiceMessage = (audioBlob: Blob): void => {
  const url = URL.createObjectURL(audioBlob);
  const audio = new Audio(url);
  audio.play();
};
