import fs from "node:fs";
import OpenAI from "openai";
import { getAudioFilePath, readAudioMetadata } from "@/lib/jobs/audio";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type TranscriptionResult = {
  text: string;
  duration?: number;
};

/**
 * Transcribe audio file using OpenAI Whisper API
 * @param sessionId - Session ID for file lookup
 * @param artifactId - Audio artifact ID
 * @returns Transcription text
 */
export async function transcribeAudio(
  sessionId: string,
  artifactId: string
): Promise<TranscriptionResult> {
  // Get audio metadata to find the stored filename
  const metadata = await readAudioMetadata(sessionId, artifactId);
  if (!metadata) {
    throw new Error(`Audio metadata not found: ${artifactId}`);
  }

  // Get the actual file path
  const audioPath = getAudioFilePath(sessionId, metadata.storedName);

  // Create a read stream for the audio file
  const audioStream = fs.createReadStream(audioPath);

  try {
    // Call Whisper API
    const response = await openai.audio.transcriptions.create({
      file: audioStream,
      model: "whisper-1",
      language: "en", // Adjust if you need other languages
      response_format: "verbose_json", // Get metadata like duration
    });

    return {
      text: response.text,
      duration: response.duration,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Whisper transcription failed: ${error.message}`);
    }
    throw new Error("Whisper transcription failed: Unknown error");
  }
}
