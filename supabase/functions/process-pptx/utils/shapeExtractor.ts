import { SlideShape } from "../types.ts";

export function extractShapes(node: any): SlideShape[] {
  const shapes: SlideShape[] = [];
  
  const walkShapes = (n: any) => {
    if (n.name === 'p:sp') {
      let shapeType = 'shape';
      let shapeText = '';
      
      const findShapeType = (node: any) => {
        if (node.name === 'p:nvSpPr' || node.name === 'p:cNvPr') {
          if (node.attributes?.name) {
            shapeType = node.attributes.name;
          }
        }
        if (node.children) {
          node.children.forEach(findShapeType);
        }
      };
      
      const findShapeText = (node: any) => {
        if (node.name === 'a:t' && node.content) {
          const text = Array.isArray(node.content) 
            ? node.content.join('').trim()
            : String(node.content).trim();
          if (text) shapeText = text;
        }
        if (node.children) {
          node.children.forEach(findShapeText);
        }
      };
      
      findShapeType(n);
      findShapeText(n);
      
      if (shapeText) {
        shapes.push({ type: shapeType, text: shapeText });
      }
    }
    if (n.children) {
      n.children.forEach(walkShapes);
    }
  };
  
  walkShapes(node);
  return shapes;
}