import { parse as parseXML } from "https://deno.land/x/xml@2.1.3/mod.ts";

export function parseXMLContent(content: string) {
  console.log("Parsing XML content");
  const xmlDoc = parseXML(content);
  if (!xmlDoc) {
    throw new Error('Could not parse XML content');
  }
  console.log("XML parsed successfully");
  return xmlDoc;
}

export function extractTextContent(node: any): string[] {
  const textContents: string[] = [];
  
  function walkNode(n: any) {
    if (!n) return;

    // Handle text content directly
    if (n.type === 'text' && n.content?.trim()) {
      console.log("Found direct text content:", n.content.trim());
      textContents.push(n.content.trim());
      return;
    }

    // Handle PowerPoint specific text elements
    if (n.name === 'a:t' && n.children) {
      const text = n.children
        .filter((child: any) => child.type === 'text')
        .map((child: any) => child.content?.trim())
        .filter(Boolean)
        .join(' ');
      
      if (text) {
        console.log("Found PowerPoint text content:", text);
        textContents.push(text);
      }
    }

    // Handle text in shape properties
    if (n.name === 'p:txBody' || n.name === 'p:sp') {
      console.log("Processing text body or shape:", n.name);
    }

    // Process text runs
    if (n.name === 'a:r') {
      console.log("Processing text run");
      const textRun = n.children
        ?.filter((child: any) => child.name === 'a:t')
        .map((tElement: any) => tElement.children
          ?.filter((textNode: any) => textNode.type === 'text')
          .map((textNode: any) => textNode.content?.trim())
          .filter(Boolean)
          .join(' ')
        )
        .filter(Boolean)
        .join(' ');

      if (textRun) {
        console.log("Found text run content:", textRun);
        textContents.push(textRun);
      }
    }
    
    // Recursively process children
    if (Array.isArray(n.children)) {
      n.children.forEach(walkNode);
    }
  }
  
  walkNode(node);
  console.log("Extracted text contents:", textContents);
  return textContents.filter(text => text.trim() !== '');
}

export function findTitle(node: any): string {
  // Look for title placeholder
  const titleShape = findShapeWithType(node, 'title');
  if (titleShape) {
    const texts = extractTextContent(titleShape);
    if (texts.length > 0) return texts[0];
  }
  
  // Look for first text content as fallback
  const allTexts = extractTextContent(node);
  return allTexts[0] || '';
}

function findShapeWithType(node: any, type: string): any {
  if (node.name === 'p:sp') {
    const nvSpPr = findNode(node, 'p:nvSpPr');
    if (nvSpPr) {
      const ph = findNode(nvSpPr, 'p:ph');
      if (ph?.attributes?.type === type) {
        return node;
      }
    }
  }
  
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findShapeWithType(child, type);
      if (found) return found;
    }
  }
  
  return null;
}

export function findNode(node: any, name: string): any {
  if (node.name === name) return node;
  
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNode(child, name);
      if (found) return found;
    }
  }
  
  return null;
}