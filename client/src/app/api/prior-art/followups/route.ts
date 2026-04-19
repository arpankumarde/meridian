import { NextRequest } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 30;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface RequestBody {
  pdfBase64?: string;
  pdfFilename?: string;
  messages: ChatMessage[];
}

const MODEL = "openai/gpt-5.4";

const SYSTEM_PROMPT = `You generate natural follow-up questions a reader might want to ask next about a specific research paper, based on the ongoing conversation. Output strictly valid JSON with exactly this shape: {"followups": ["q1", "q2", "q3"]}. Each question must be short (under 90 chars), specific to the paper's content, and meaningfully distinct from each other and from questions already asked. Do not repeat previous questions. Do not include numbering or prefixes.`;

export async function POST(req: NextRequest) {
  try {
    const { pdfBase64, pdfFilename, messages } = (await req.json()) as RequestBody;
    const baseURL = process.env.OPENAI_BASE_URL;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!baseURL || !apiKey) {
      return Response.json(
        { error: "OPENAI_BASE_URL or OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }
    if (!messages || messages.length === 0) {
      return Response.json({ error: "messages required" }, { status: 400 });
    }

    const client = new OpenAI({
      baseURL,
      apiKey,
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3004",
        "X-Title": "Meridian Prior-Art Followups",
      },
    });

    // Build messages with PDF attached to the first user turn (same pattern as chat route).
    const enriched: unknown[] = [{ role: "system", content: SYSTEM_PROMPT }];
    let pdfAttached = false;
    for (const m of messages) {
      if (!pdfAttached && m.role === "user" && pdfBase64) {
        enriched.push({
          role: "user",
          content: [
            {
              type: "file",
              file: {
                filename: pdfFilename || "paper.pdf",
                file_data: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
            { type: "text", text: m.content },
          ],
        });
        pdfAttached = true;
      } else {
        enriched.push({ role: m.role, content: m.content });
      }
    }
    enriched.push({
      role: "user",
      content:
        'Based on the conversation and the paper, return 3 follow-up questions as JSON: {"followups": ["q1","q2","q3"]}. No extra text.',
    });

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: enriched as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      response_format: { type: "json_object" },
      plugins: [{ id: "file-parser", pdf: { engine: "mistral-ocr" } }],
    } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    let followups: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.followups)) {
        followups = parsed.followups
          .filter((q: unknown) => typeof q === "string" && q.trim().length > 0)
          .slice(0, 3)
          .map((q: string) => q.trim());
      }
    } catch {
      // Fallback: split lines if the model returned plain text.
      followups = raw
        .split(/\r?\n/)
        .map((l) => l.replace(/^[-*\d.\s]+/, "").trim())
        .filter((l) => l.length > 0 && l.length < 160)
        .slice(0, 3);
    }

    return Response.json({ followups });
  } catch (err) {
    console.error("[prior-art/followups] error", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
