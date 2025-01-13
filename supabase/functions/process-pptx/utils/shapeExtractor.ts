import { SlideShape } from "../types.ts";
import { extractTextContent } from "./xmlParser.ts";

export function extractShapes(node: any): SlideShape[] {
  const shapes: SlideShape[] = [];
  
  function walkShapes(n: any) {
    // Handle specific shape types
    if (n.name === 'p:sp' || n.name === 'p:graphicFrame' || n.name === 'p:pic') {
      let shapeType = n.name.replace('p:', '');
      let shapeName = '';
      
      // Try to get shape name from properties
      if (n.children) {
        const nvProps = n.children.find((c: any) => 
          c.name === 'p:nvSpPr' || c.name === 'p:nvGraphicFramePr' || c.name === 'p:nvPicPr'
        );
        
        if (nvProps?.children) {
          const cNvPr = nvProps.children.find((c: any) => c.name === 'p:cNvPr');
          if (cNvPr?.attributes?.name) {
            shapeName = cNvPr.attributes.name;
          }
        }
      }
      
      // Get shape text content
      const texts = extractTextContent(n);
      if (texts.length > 0) {
        shapes.push({
          type: shapeName || shapeType,
          text: texts.join(' ')
        });
      }
    }
    
    // Recursively process children
    if (n.children) {
      n.children.forEach(walkShapes);
    }
  }
  
  walkShapes(node);
  return shapes;
}