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
  
  const walkTextContent = (n: any) => {
    if (n.name === 'a:t' && n.content) {
      const text = Array.isArray(n.content) 
        ? n.content.join('').trim()
        : String(n.content).trim();
      if (text) textContents.push(text);
    }
    if (n.children) {
      n.children.forEach(walkTextContent);
    }
  };
  
  walkTextContent(node);
  return textContents;
}

export function findTitle(node: any): string {
  let title = '';
  
  const findTitleNode = (n: any): boolean => {
    if (n.name === 'p:title' || n.name === 'p:cSld') {
      const titleTexts = extractTextContent(n);
      if (titleTexts.length > 0) {
        title = titleTexts.join(' ');
        return true;
      }
    }
    if (n.children) {
      for (const child of n.children) {
        if (findTitleNode(child)) return true;
      }
    }
    return false;
  };
  
  findTitleNode(node);
  return title;
}