'use client';

import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/utils';

interface RenderMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Renderiza markdown del LLM con sanitizacion contra XSS.
 *
 * Reglas duras (R18):
 * - NUNCA usar dangerouslySetInnerHTML con output del LLM.
 * - rehype-sanitize filtra <script>, <iframe>, on* handlers, javascript: URLs.
 * - El LLM puede responder con code blocks, listas, bold, links — todo OK.
 */
export function RenderMarkdown({ content, className }: RenderMarkdownProps) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none break-words text-sm leading-relaxed',
        'prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1',
        'prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-xs',
        'prose-pre:bg-muted prose-pre:p-3 prose-pre:rounded-md',
        'dark:prose-invert',
        className,
      )}
    >
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{content}</ReactMarkdown>
    </div>
  );
}
