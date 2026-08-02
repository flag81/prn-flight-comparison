import { GoogleGenAI } from '@google/genai';
import JSON5 from 'json5';
import { promises as fs } from 'fs';
import path from 'path';

export interface FlightData {
  departure_time: string;
  arrival_time: string;
  flight_number: string;
  airline: string;
  price: string;
  is_return?: boolean;
}

const aiStudio = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const MAX_RETRIES = 3;

export const FLIGHT_EXTRACTION_PROMPT = `The image shows flight search results from a booking website. Each flight card contains:

- A flight number (e.g. "IV 8234")
- An operator/airline name (e.g. "GP-Aviation")
- Departure time and arrival time (e.g. "05:20" → "07:20")
- Duration (e.g. "Duration: 2h")
- A price in EUR displayed in **red/bold color**
- A label "incl. € X.XX taxes and surcharges" in normal weight — this is NOT the price

For each flight card, the price is the euro amount rendered in **red bold text** — use that as the price value. Do NOT confuse it with the "incl. taxes" line which appears below in non-red text.

Return a JSON array where each object has:
- departure_time (string, e.g. "05:20")
- arrival_time (string, e.g. "07:20")
- flight_number (string, e.g. "IV 8234")
- airline (string, e.g. "GP-Aviation")
- price (string, the red bold euro amount, e.g. "70.00" or "Sold Out")
- is_return (boolean: true if under "Return flight:" section, false if under "Outbound flight:")

Example: [{"departure_time":"05:20","arrival_time":"07:20","flight_number":"IV 8234","airline":"GP-Aviation","price":"70.00","is_return":false}]

Return ONLY the raw JSON array, no markdown, no code fences.`;

export async function callGeminiWithImage(buffer: Buffer, prompt: string = FLIGHT_EXTRACTION_PROMPT): Promise<FlightData[] | null> {
  const imagePart = {
    inlineData: {
      mimeType: 'image/png',
      data: buffer.toString('base64'),
    },
  };

  const debugDir = path.join(process.cwd(), '.debug', 'gemini-images');
  await fs.mkdir(debugDir, { recursive: true });
  const filename = `gemini-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  const filepath = path.join(debugDir, filename);
  await fs.writeFile(filepath, buffer);
  console.info(`[Gemini] Saved debug image to ${filepath}`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.info(`[Gemini] Attempt ${attempt} - sending image payload`);

      const result = await aiStudio.models.generateContent({
        model: GEMINI_MODEL,
        contents: [prompt, imagePart],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const responseText = (result as { text?: string }).text ?? JSON.stringify(result);
      const cleaned = responseText.replace(/```json|```/g, '').trim();

      const parsed = JSON5.parse(cleaned) as FlightData[];
      console.log(`[Gemini] Raw response:`, JSON.stringify(parsed));
      return parsed;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Gemini] Error on attempt ${attempt}:`, message);
      if (attempt === MAX_RETRIES) throw err;
      await new Promise((res) => setTimeout(res, 1000 * attempt));
    }
  }
  return null;
}
