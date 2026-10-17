import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Teacher-written text (readings, instructions) as Markdown. Safe by construction: raw HTML in the source is
 * dropped (`skipHtml`) and react-markdown's default URL filter removes `javascript:` and other unsafe links, so
 * nothing a teacher types can run script. Line breaks are kept, so text written before Markdown support reads the
 * same. External links open in a new tab.
 */
const components: Components = {
  h1: ({ children }) => <h3 className="mt-6 mb-2 font-display text-2xl font-bold">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-6 mb-2 font-display text-xl font-bold">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-5 mb-2 text-lg font-bold">{children}</h4>,
  h4: ({ children }) => <h5 className="mt-4 mb-1 font-bold">{children}</h5>,
  p: ({ children }) => <p className="my-3 whitespace-pre-line">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal pl-6">{children}</ol>,
  li: ({ children }) => <li className="my-1 whitespace-pre-line">{children}</li>,
  a: ({ href, children }) => {
    const external = !!href && /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        className="font-semibold text-primary-fg underline underline-offset-2"
        {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
      >
        {children}
      </a>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-line-strong pl-4 text-muted">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-xl bg-canvas p-4 font-mono text-sm">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-line-strong px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-line px-3 py-2">{children}</td>,
  hr: () => <hr className="my-6 border-line" />,
  img: ({ alt }) => <span className="text-muted">[image: {alt || "no description"}]</span>,
};

export function Markdown({ children, className = "" }: { children: string; className?: string }): ReactNode {
  return (
    <div className={`max-w-prose leading-relaxed ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** One line for writers: what formatting works. */
export const MARKDOWN_HINT =
  "Formatting: **bold**, *italic*, # Heading, - lists, 1. numbered lists, [link text](https://…)";
