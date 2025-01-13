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
    // Handle PowerPoint text elements
    if (n.name === 'a:t' && n.children) {
      const text = n.children
        .filter((child: any) => child.type === 'text')
        .map((child: any) => child.content.toString())
        .join('')
        .trim();
      
      if (text) {
        textContents.push(text);
      }
    }
    
    // Handle text runs and paragraphs
    if (n.name === 'a:r' || n.name === 'a:p' || n.name === 'p:txBody') {
      if (Array.isArray(n.children)) {
        n.children.forEach(walkNode);
      }
    }
    
    // Recursively process other elements
    if (Array.isArray(n.children)) {
      n.children.forEach(walkNode);
    }
  }
  
  walkNode(node);
  return textContents.filter(text => text.trim() !== '');
}

export function findNode(node: any, nodeName: string): any {
  if (node.name === nodeName) return node;
  
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNode(child, nodeName);
      if (found) return found;
    }
  }
  
  return null;
}

export function findTitle(node: any): string {
  // Look for title placeholder
  const titleShape = findShapeByType(node, 'title');
  if (titleShape) {
    const texts = extractTextContent(titleShape);
    if (texts.length > 0) return texts.join(' ');
  }
  
  // Look for first shape with text as fallback
  const firstShape = findNode(node, 'p:sp');
  if (firstShape) {
    const texts = extractTextContent(firstShape);
    if (texts.length > 0) return texts[0];
  }
  
  return '';
}

function findShapeByType(node: any, type: string): any {
  function walkShapes(n: any): any {
    if (n.name === 'p:sp') {
      const nvSpPr = findNode(n, 'p:nvSpPr');
      if (nvSpPr) {
        const ph = findNode(nvSpPr, 'p:ph');
        if (ph?.attributes?.type === type) {
          return n;
        }
      }
    }
    
    if (Array.isArray(n.children)) {
      for (const child of n.children) {
        const found = walkShapes(child);
        if (found) return found;
      }
    }
    
    return null;
  }
  
  return walkShapes(node);
}