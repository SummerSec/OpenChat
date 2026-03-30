// src/lib/custom-fetcher.ts
import { streamText, type CoreMessage } from "ai";
import type { Friend } from "../types/chat";
import { createModelInstance } from "./ai-sdk-adapters";

interface FetcherOptions {
  friend: Friend;
  systemPrompt?: string;
  onDelta?: (type: "content" | "thinking", text: string) => void;
  onComplete?: (content: string, thinking: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Creates a custom fetcher for browser-direct streaming with the Vercel AI SDK.
 * This fetcher is designed to work with the `useChat` hook.
 *
 * The fetcher:
 * 1. Parses the request body to extract messages
 * 2. Creates a model instance from the friend configuration
 * 3. Streams text using the Vercel AI SDK
 * 4. Tees the stream to support both returning and processing
 * 5. Parses SSE-formatted data to extract content and thinking deltas
 * 6. Calls appropriate callbacks during streaming
 */
export function createCustomFetcher(options: FetcherOptions) {
  const { friend, systemPrompt, onDelta, onComplete, onError } = options;

  return async function customFetcher(
    _url: string,
    requestInit: RequestInit,
  ): Promise<Response> {
    try {
      const body = JSON.parse(requestInit.body as string);
      // Use CoreMessage type which is more flexible for SDK usage
      const messages: CoreMessage[] = body.messages || [];

      // Add system prompt if provided
      const fullMessages: CoreMessage[] = systemPrompt
        ? [{ role: "system", content: systemPrompt }, ...messages]
        : messages;

      // Create model instance using the adapter
      const model = createModelInstance(friend);

      // Stream text using Vercel AI SDK
      const result = streamText({
        model,
        messages: fullMessages,
      });

      // Get the data stream response (for useChat consumption)
      const streamResponse = result.toDataStreamResponse({
        sendReasoning: true,
      });

      // Tee the stream to support both returning and processing
      const [streamForProcessing, streamForResponse] =
        streamResponse.body!.tee();

      // Process one stream for callbacks in the background
      processStreamForCallbacks(streamForProcessing, onDelta, onComplete, onError);

      // Return the other stream as a new Response
      return new Response(streamForResponse, {
        headers: streamResponse.headers,
        status: streamResponse.status,
        statusText: streamResponse.statusText,
      });
    } catch (error) {
      onError?.(error as Error);
      throw error;
    }
  };
}

/**
 * Processes a stream to extract content and thinking deltas.
 * Calls the appropriate callbacks as data is received.
 */
async function processStreamForCallbacks(
  stream: ReadableStream<Uint8Array>,
  onDelta: ((type: "content" | "thinking", text: string) => void) | undefined,
  onComplete:
    | ((content: string, thinking: string) => void)
    | undefined,
  onError: ((error: Error) => void) | undefined,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let fullThinking = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines from buffer
      const lines = buffer.split("\n");
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Parse the stream data
        const result = parseStreamLine(trimmedLine);
        if (!result) continue;

        // Update accumulators and call onDelta
        if (result.type === "content" && result.text) {
          fullContent += result.text;
          onDelta?.("content", result.text);
        } else if (result.type === "thinking" && result.text) {
          fullThinking += result.text;
          onDelta?.("thinking", result.text);
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      const result = parseStreamLine(buffer.trim());
      if (result) {
        if (result.type === "content" && result.text) {
          fullContent += result.text;
          onDelta?.("content", result.text);
        } else if (result.type === "thinking" && result.text) {
          fullThinking += result.text;
          onDelta?.("thinking", result.text);
        }
      }
    }

    // Call onComplete with final content
    onComplete?.(fullContent, fullThinking);
  } catch (error) {
    onError?.(error as Error);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parses a single line from the SSE stream.
 * Handles the `data: ` prefix and JSON parsing.
 *
 * Returns null if the line should be skipped or cannot be parsed.
 * Returns { type, text } for content and thinking deltas.
 *
 * This handles the Vercel AI SDK data stream format which uses:
 * - "0:" prefix for text content
 * - "1:" prefix for reasoning/thinking content
 * - "2:" prefix for data
 * - "3:" prefix for error
 * - "e:" prefix for finish events
 */
function parseStreamLine(
  line: string,
): { type: "content" | "thinking"; text: string } | null {
  // Handle SSE data: prefix
  if (!line.startsWith("data: ")) {
    return null;
  }

  const data = line.slice(6).trim();

  // Skip empty data
  if (!data) {
    return null;
  }

  // Handle stream termination marker
  if (data === "[DONE]") {
    return null;
  }

  // Handle Vercel AI SDK data stream format
  // Format: "0:text" for content, "1:reasoning" for thinking
  if (data.startsWith('"0:')) {
    // Content line - parse the JSON string after "0:
    try {
      const text = JSON.parse(data.slice(1));
      return { type: "content", text };
    } catch {
      return null;
    }
  }

  if (data.startsWith('"1:')) {
    // Thinking/reasoning line - parse the JSON string after "1:
    try {
      const text = JSON.parse(data.slice(1));
      return { type: "thinking", text };
    } catch {
      return null;
    }
  }

  // Handle error events
  if (data.startsWith('"3:')) {
    try {
      const errorText = JSON.parse(data.slice(1));
      throw new Error(errorText || "Stream error");
    } catch {
      return null;
    }
  }

  // Handle finish events ("e:") - ignore for parsing purposes
  if (data.startsWith('"e:')) {
    return null;
  }

  // Try to parse as JSON for other formats
  try {
    const parsed = JSON.parse(data);

    if (parsed.type === "error") {
      throw new Error(parsed.message || "Stream error");
    }

    // Handle different message types
    if (parsed.type === "content" || parsed.type === "text") {
      return { type: "content", text: parsed.content || parsed.text || "" };
    }

    if (parsed.type === "reasoning" || parsed.type === "thinking") {
      return { type: "thinking", text: parsed.content || parsed.text || "" };
    }

    // Handle OpenAI-style delta format
    if (parsed.choices && parsed.choices[0]) {
      const delta = parsed.choices[0].delta;
      if (delta) {
        if (delta.content) {
          return { type: "content", text: delta.content };
        }
        if (delta.reasoning_content || delta.thinking) {
          return {
            type: "thinking",
            text: delta.reasoning_content || delta.thinking,
          };
        }
      }
    }

    // Handle raw content field
    if (parsed.content && typeof parsed.content === "string") {
      return { type: "content", text: parsed.content };
    }

    // Handle raw text field
    if (parsed.text && typeof parsed.text === "string") {
      return { type: "content", text: parsed.text };
    }

    return null;
  } catch {
    // If JSON parsing fails, treat as plain text (for simple streams)
    if (data && !data.startsWith("{")) {
      return { type: "content", text: data };
    }
    return null;
  }
}
