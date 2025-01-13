import { SlideShape } from "../types.ts";
import { extractTextContent } from "./xmlParser.ts";

export function extractShapes(node: any): SlideShape[] {
  const shapes: SlideShape[] = [];
  
  function walkShapes(n: any) {
    // Handle shape elements
    if (n.name === 'p:sp') {
      let shapeType = 'shape';
      let shapeText = '';
      
      // Extract shape type
      if (n.children) {
        const nvSpPr = n.children.find((child: any) => child.name === 'p:nvSpPr');
        if (nvSpPr?.children) {
          const cNvPr = nvSpPr.children.find((child: any) => child.name === 'p:cNvPr');
          if (cNvPr?.attributes?.name) {
            shapeType = cNvPr.attributes.name;
          }
        }
      }
      
      // Extract shape text content
      const texts = extractTextContent(n);
      if (texts.length > 0) {
        shapeText = texts.join(' ');
      }
      
      if (shapeText) {
        shapes.push({ type: shapeType, text: shapeText });
      }
    }
    
    // Handle other shape types (textboxes, etc.)
    if (n.name === 'p:graphicFrame' || n.name === 'p:pic') {
      const texts = extractTextContent(n);
      if (texts.length > 0) {
        shapes.push({
          type: n.name.replace('p:', ''),
          text: texts.join(' ')
        });
      }
    }
    
    if (n.children) {
      n.children.forEach(walkShapes);
    }
  }
  
  walkShapes(node);
  return shapes;
}