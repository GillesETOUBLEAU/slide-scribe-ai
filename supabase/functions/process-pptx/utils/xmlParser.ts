import { parse as parseXML } from "https://deno.land/x/xml@2.1.3/mod.ts";

export function parseXMLContent(content: string) {
  const xmlDoc = parseXML(content);
  if (!xmlDoc) {
    throw new Error('Could not parse XML content');
  }
  return xmlDoc;
}

export function extractTextContent(node: any): string[] {
  const textContents: string[] = [];
  
  function walkNode(n: any) {
    // Handle direct text content
    if (n.type === 'text' && typeof n.content === 'string') {
      const text = n.content.trim();
      if (text) textContents.push(text);
      return;
    }
    
    // Handle XML text elements
    if (n.name === 'a:t') {
      let text = '';
      if (Array.isArray(n.children)) {
        text = n.children
          .filter((child: any) => child.type === 'text')
          .map((child: any) => child.content)
          .join('')
          .trim();
      } else if (n.content) {
        text = String(n.content).trim();
      }
      if (text) textContents.push(text);
    }
    
    // Recursively process children
    if (Array.isArray(n.children)) {
      n.children.forEach(walkNode);
    }
  }
  
  walkNode(node);
  return textContents;
}

export function findTitle(node: any): string {
  let title = '';
  
  function walkTitleNode(n: any): boolean {
    if (n.name === 'p:title' || n.name === 'p:cSld') {
      const titleTexts = extractTextContent(n);
      if (titleTexts.length > 0) {
        title = titleTexts.join(' ');
        return true;
      }
    }
    
    if (n.name === 'p:ph' && n.attributes?.type === 'title') {
      const parent = n.parent;
      if (parent) {
        const texts = extractTextContent(parent);
        if (texts.length > 0) {
          title = texts.join(' ');
          return true;
        }
      }
    }
    
    if (n.children) {
      for (const child of n.children) {
        if (walkTitleNode(child)) return true;
      }
    }
    return false;
  }
  
  walkTitleNode(node);
  return title || 'Untitled Slide';
}