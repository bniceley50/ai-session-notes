import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type ClinicalNoteType = "soap" | "dap" | "birp" | "girp" | "intake" | "progress";

export type ClinicalNote = {
  text: string;
  tokens?: number;
};

/** @deprecated Use generateClinicalNote instead */
export async function generateSOAPNote(transcript: string): Promise<ClinicalNote> {
  return generateClinicalNote(transcript, "soap");
}

const NOTE_TYPE_PROMPTS: Record<ClinicalNoteType, string> = {
  soap: `Generate a professional SOAP note from the following therapy session transcript.

FORMAT — use these exact section headings:
## Subjective
## Objective
## Assessment
## Plan`,

  dap: `Generate a professional DAP note from the following therapy session transcript.

FORMAT — use these exact section headings:
## Data
## Assessment
## Plan`,

  birp: `Generate a professional BIRP note from the following therapy session transcript.

FORMAT — use these exact section headings:
## Behavior
## Intervention
## Response
## Plan`,

  girp: `Generate a professional GIRP note from the following therapy session transcript.

FORMAT — use these exact section headings:
## Goals
## Intervention
## Response
## Plan`,

  intake: `Generate a professional Intake/Assessment note from the following therapy session transcript.

FORMAT — use these exact section headings:
## Presenting Problem
## History
## Mental Status Exam
## Clinical Impressions
## Recommendations`,

  progress: `Generate a professional Progress Note from the following therapy session transcript.

FORMAT — use these exact section headings:
## Session Focus
## Interventions Used
## Client Response
## Progress Toward Goals
## Plan`,
};

const NOTE_TYPE_LABELS: Record<ClinicalNoteType, string> = {
  soap: "SOAP Note",
  dap: "DAP Note",
  birp: "BIRP Note",
  girp: "GIRP Note",
  intake: "Intake/Assessment",
  progress: "Progress Note",
};

/**
 * Generate a clinical note from a therapy session transcript using Claude
 * @param transcript - The session transcript text
 * @param noteType - The type of clinical note to generate
 * @returns Clinical note in markdown format
 */
export async function generateClinicalNote(
  transcript: string,
  noteType: ClinicalNoteType = "soap",
  signal?: AbortSignal,
): Promise<ClinicalNote> {
  const typePrompt = NOTE_TYPE_PROMPTS[noteType] ?? NOTE_TYPE_PROMPTS.soap;
  const typeLabel = NOTE_TYPE_LABELS[noteType] ?? "Clinical Note";

  const prompt = `You are a clinical documentation assistant for mental health professionals.
${typePrompt}

IMPORTANT GUIDELINES:
- Use clear, objective clinical language
- Be concise but thorough
- Include relevant clinical observations
- Note any risk factors or safety concerns
- Use proper mental health terminology

TRANSCRIPT:
${transcript}

Generate a ${typeLabel} in markdown format:`;

  try {
    const response = await anthropic.messages.create(
      {
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      },
      { signal },
    );

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    return {
      text: content.text,
      tokens: response.usage.input_tokens + response.usage.output_tokens,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Claude API failed: ${error.message}`);
    }
    throw new Error("Claude API failed: Unknown error");
  }
}
