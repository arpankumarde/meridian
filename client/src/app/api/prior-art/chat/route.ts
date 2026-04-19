import { NextRequest } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

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

const SYSTEM_PROMPT = `You are a research assistant that helps a user understand a specific research paper they have uploaded. Ground every answer in the paper's content. If the answer is not in the paper, say so. When useful, quote short passages and reference sections. Respond in clean, well-structured markdown.`;

export async function POST(req: NextRequest) {
  try {
    const { pdfBase64, pdfFilename, messages } = (await req.json()) as RequestBody;
    const baseURL = process.env.OPENAI_BASE_URL;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!baseURL || !apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_BASE_URL or OPENAI_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const client = new OpenAI({
      baseURL,
      apiKey,
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3004",
        "X-Title": "Meridian Prior-Art",
      },
    });

    // Build messages: attach PDF file part on the first user turn using OpenRouter's file content type.
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

    const stream = await client.chat.completions.create({
      model: MODEL,
      stream: true,
      messages: enriched as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      // OpenRouter file-parser plugin: converts PDFs to text before the chat model sees them.
      // `mistral-ocr` handles scanned / image-heavy PDFs (including arxiv scans).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plugins: [{ id: "file-parser", pdf: { engine: "mistral-ocr" } }],
    } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming);

    const encoder = new TextEncoder();
    const responseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) {
              controller.enqueue(encoder.encode(delta));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err) {
    console.error("[prior-art/chat] error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
