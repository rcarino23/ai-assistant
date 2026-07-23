// src/components/chat/markdown.tsx
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./code-block";

interface MarkdownProps {
  content: string;
}

export function Markdown({ content }: MarkdownProps) {
  return (
    <div className="chat-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { className, children, ...rest } = props;
            const match = /language-(\w+)/.exec(className || "");
            const isBlock = Boolean(match);
            const value = String(children).replace(/\n$/, "");

            if (!isBlock) {
              return (
                <code className={className} {...rest}>
                  {children}
                </code>
              );
            }

            return <CodeBlock language={match?.[1]} code={value} />;
          },
          // Tables can have far more columns than fit in the chat bubble
          // (e.g. wide CSV joins like the payroll one). Wrap each table in
          // its own horizontally scrollable container instead of letting
          // it push the whole page wider — the scrollbar stays local to
          // the table.
          table(props) {
            const { children, ...rest } = props;
            return (
              <div className="chat-table-wrapper">
                <table {...rest}>{children}</table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}