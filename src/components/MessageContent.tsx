/**
 * Renders model output as plain text.
 *
 * No Markdown parser and no dangerouslySetInnerHTML: React escapes the string,
 * so nothing the model produces can become markup. Whitespace and line breaks
 * are preserved through CSS instead.
 */
export function MessageContent({ content }: { content: string }) {
  return <div className="message__content">{content}</div>
}
