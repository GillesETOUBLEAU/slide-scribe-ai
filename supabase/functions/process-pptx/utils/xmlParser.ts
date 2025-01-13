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
    // Handle PowerPoint specific text containers
    if (n.name === 'p:txBody' || n.name === 'a:p') {
      const texts = extractParagraphText(n);
      textContents.push(...texts);
      return;
    }
    
    // Process shapes and other text containers
    if (n.name === 'p:sp' || n.name === 'p:graphicFrame') {
      // Look for text body within shapes
      const txBody = findNode(n, 'p:txBody');
      if (txBody) {
        const texts = extractParagraphText(txBody);
        textContents.push(...texts);
      }
    }
    
    // Recursively process children
    if (Array.isArray(n.children)) {
      n.children.forEach(walkNode);
    }
  }
  
  walkNode(node);
  return textContents.filter(text => text.trim() !== '');
}

function extractParagraphText(node: any): string[] {
  const texts: string[] = [];
  
  function walkTextNode(n: any) {
    // Handle direct text content
    if (n.type === 'text') {
      const text = n.content?.toString().trim();
      if (text) texts.push(text);
      return;
    }
    
    // Handle PowerPoint text run elements
    if (n.name === 'a:r') {
      const textElement = findNode(n, 'a:t');
      if (textElement?.content) {
        const text = Array.isArray(textElement.content) 
          ? textElement.content.join('').trim()
          : textElement.content.toString().trim();
        if (text) texts.push(text);
      }
    }
    
    // Recursively process children
    if (Array.isArray(n.children)) {
      n.children.forEach(walkTextNode);
    }
  }
  
  walkTextNode(node);
  return texts;
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
  
  return 'Untitled Slide';
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