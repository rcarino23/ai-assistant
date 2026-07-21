# AI Assistant

A Claude-inspired AI chat app built with Next.js 15 (App Router), React 19, TypeScript, and Tailwind CSS.

This is a **working foundation**, not the full enterprise spec — see "What's stubbed" below for what's designed-in but not yet built end-to-end.

## What works right now

- Full chat UI: streaming responses, markdown rendering, syntax-highlighted code blocks with a copy button, stop generation, regenerate, edit a previous prompt (re-runs the conversation from that point), retry, timestamps
- Light/dark theme
- Sidebar: new chat, search, pin, delete, conversations persisted to `localStorage`
- A real, working **Anthropic Claude** provider with streaming
- A **provider abstraction layer** (`src/features/providers/`) so the UI and API route never talk to a specific vendor directly — they talk to an `AIProvider` interface. OpenAI, Gemini, Groq, OpenRouter, Ollama, and Azure OpenAI are registered as `StubProvider`s: they already show up in the model picker (correctly greyed out because no key is configured) and satisfy the same interface, so wiring one up later is "write a class like `AnthropicProvider`," not "redesign the app."

## Getting started

```bash
npm install
cp .env.local.example .env.local
# add your key:
#   ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Open http://localhost:3000.

## Project structure

```
src/
  app/
    api/chat/route.ts        Streams a provider's response as SSE
    api/providers/route.ts   Which providers are configured (for the model picker)
    page.tsx                 App shell: sidebar + header + chat window
  components/
    ui/                      Small style primitives (button, textarea, select, icon button)
    chat/                    Sidebar, header, message list/item, input, markdown, code block
  features/
    providers/               AIProvider interface, AnthropicProvider, StubProvider, registry
    chat/                    useChat hook (send/stop/regenerate/edit/retry), localStorage persistence
    agents/                  Types + starter agents — NOT wired into the UI yet
    documents/                Types for upload/context selection — NOT wired into the UI yet
    prompts/                  Types + starter prompt library — NOT wired into the UI yet
    settings/                 App-level settings types — NOT wired into a settings page yet
  types/                      Shared ChatMessage / Conversation / ProviderSettings types
```

## What's stubbed (designed for, not built)

The original spec asked for a much larger platform: document upload with RAG-style context, a prompt library, custom agents, a full settings page, chat export/import, Mermaid/LaTeX rendering, virtualized message lists, MCP tool calling, and more.

Building all of that as real, working code in one pass wasn't realistic to also get right, tested, and reviewable. Instead, the folders and types for agents, documents, prompts, and settings are in place with comments explaining exactly where they plug into the existing chat flow — e.g. an `Agent` just resolves to a system prompt + provider defaults, so it slots into `ChatWindow`'s `settings` prop with no other changes; a selected `UploadedDocument`'s text just gets prepended to the `messages` array before it's sent, since providers only ever see `ChatMessage[]`.

## Adding a real provider (e.g. OpenAI)

1. Create `src/features/providers/openai-provider.ts` implementing `AIProvider` (copy `anthropic-provider.ts` as a template — same `streamChat` async-generator shape).
2. In `src/features/providers/registry.ts`, swap the `StubProvider` entry for `openai` with `new OpenAIProvider()`.
3. Add `OPENAI_API_KEY` to `.env.local`.

Nothing in `components/` or `app/page.tsx` needs to change.
