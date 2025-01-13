import { SlideShape } from "../types.ts";
import { extractTextContent, findNode } from "./xmlParser.ts";

export function extractShapes(node: any): SlideShape[] {
  const shapes: SlideShape[] = [];
  
  function walkShapes(n: any) {
    if (n.name === 'p:sp') {
      // Get shape type
      const nvSpPr = findNode(n, 'p:nvSpPr');
      const ph = nvSpPr ? findNode(nvSpPr, 'p:ph') : null;
      const type = ph?.attributes?.type || 'shape';
      
      // Get shape text
      const texts = extractTextContent(n);
      if (texts.length > 0) {
        shapes.push({
          type,
          text: texts.join(' ')
        });
      }
    }
    
    if (Array.isArray(n.children)) {
      n.children.forEach(walkShapes);
    }
  }
  
  walkShapes(node);
  return shapes;
}