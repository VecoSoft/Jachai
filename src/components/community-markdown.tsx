import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders a post/comment body as Markdown — safe by design: no rehype-raw
 * plugin is used, so any literal HTML typed into the source is shown as
 * plain text rather than executed (react-markdown's core behavior, not an
 * opt-in), and react-markdown's built-in urlTransform strips unsafe link
 * schemes (e.g. javascript:) by default. Never pass rehype-raw here — doing
 * so would reopen stored-XSS on every post/comment body in the app.
 */
export function CommunityMarkdown({
  children,
  className,
  headingId,
}: {
  children: string;
  className?: string;
  /** Optional anchor id for ## headings (e.g. FAQ topics that other pages link to). */
  headingId?: (text: string) => string | undefined;
}) {
  return (
    <div className={cn("prose-community", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-crimson-600 underline hover:text-crimson-700">
              {linkChildren}
            </a>
          ),
          p: ({ children: p }) => <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0">{p}</p>,
          ul: ({ children: ul }) => <ul className="my-1.5 list-disc pl-5">{ul}</ul>,
          ol: ({ children: ol }) => <ol className="my-1.5 list-decimal pl-5">{ol}</ol>,
          li: ({ children: li }) => <li className="my-0.5">{li}</li>,
          blockquote: ({ children: bq }) => (
            <blockquote className="my-1.5 border-l-2 border-ink-200 pl-3 text-ink-600 italic">{bq}</blockquote>
          ),
          h1: ({ children: h }) => <h1 className="mt-3 mb-1.5 font-display text-lg font-bold text-ink-900">{h}</h1>,
          h2: ({ children: h }) => (
            <h2
              id={headingId?.(String(h))}
              className="mt-3 mb-1.5 scroll-mt-28 font-display text-base font-bold text-ink-900"
            >
              {h}
            </h2>
          ),
          h3: ({ children: h }) => <h3 className="mt-2 mb-1 font-display text-sm font-bold text-ink-900">{h}</h3>,
          code: ({ className: codeClassName, children: code }) => (
            <code className={cn("rounded bg-ink-100 px-1 py-0.5 font-mono text-[0.85em] text-ink-800", codeClassName)}>
              {code}
            </code>
          ),
          pre: ({ children: pre }) => (
            <pre className="my-2 overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs text-ink-50 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
              {pre}
            </pre>
          ),
          table: ({ children: table }) => (
            <div className="my-2 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">{table}</table>
            </div>
          ),
          th: ({ children: th }) => (
            <th className="border border-ink-200 bg-ink-50 px-2 py-1 text-left font-semibold">{th}</th>
          ),
          td: ({ children: td }) => <td className="border border-ink-200 px-2 py-1">{td}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
