export function extractHtmlTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return undefined;
  }

  const normalized = match[1].replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
}
