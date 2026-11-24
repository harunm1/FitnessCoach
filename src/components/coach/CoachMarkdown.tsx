// Renders the coach's Markdown reply as elements, never as raw HTML (live bug, 23 Nov 2026).
// react-markdown does not parse raw HTML (it is shown as text) and drops unsafe URLs such as
// javascript:; remark-gfm adds tables, which the model writes for plans.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function CoachMarkdown({ text }: { text: string }) {
  return (
    <div className="text-sm leading-6 [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_table]:my-2 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_td]:border [&_td]:border-foreground/20 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-foreground/20 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
