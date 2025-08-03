const WIKI_LINK_REGEX = /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;

export function extractWikiLinks(content: string): string[] {
  const links: string[] = [];
  let match;
  
  while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
    if (match[1]) {
      links.push(match[1].trim());
    }
  }
  
  return [...new Set(links)]; // Remove duplicates
}