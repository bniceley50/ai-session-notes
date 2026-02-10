import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type SOAPNote = {
  text: string;
  tokens?: number;
};

/**
 * Generate a SOAP note from a therapy session transcript using Claude
 * @param transcript - The session transcript text
 * @returns SOAP note in markdown format
 */
export async function generateSOAPNote(transcript: string): Promise<SOAPNote> {
  const prompt = `You are a clinical documentation assistant for mental health professionals. 
Generate a professional SOAP note from the following therapy session transcript.

IMPORTANT GUIDELINES:
- Use clear, objective clinical language
- Follow SOAP format: Subjective, Objective, Assessment, Plan
- Be concise but thorough
- Include relevant clinical observations
- Note any risk factors or safety concerns
- Use proper mental health terminology

TRANSCRIPT:
${transcript}

Generate a SOAP note in markdown format:`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

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
