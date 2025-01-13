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
    // Check for text content in various PPTX XML elements
    if (n.name === 'a:t' && n.content) {
      const text = Array.isArray(n.content) 
        ? n.content.join('').trim()
        : String(n.content).trim();
      if (text) textContents.push(text);
    }
    
    // Special handling for paragraphs and text runs
    if (n.name === 'p:sp' || n.name === 'a:p' || n.name === 'a:r') {
      if (n.children) {
        n.children.forEach(walkNode);
      }
    }
    
    // Recursively process all children
    if (n.children) {
      n.children.forEach(walkNode);
    }
  }
  
  walkNode(node);
  return textContents;
}

export function findTitle(node: any): string {
  let title = '';
  
  function walkTitleNode(n: any): boolean {
    // Check specific title-related elements
    if (n.name === 'p:title' || n.name === 'p:cSld') {
      const titleTexts = extractTextContent(n);
      if (titleTexts.length > 0) {
        title = titleTexts.join(' ');
        return true;
      }
    }
    
    // Check for title placeholder
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