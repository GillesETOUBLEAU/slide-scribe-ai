import { Slide } from "../types.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

export async function processSlide(zipContent: any, slideFile: string, slideContent: string): Promise<Slide> {
  console.log(`Processing slide content for ${slideFile}`);
  
  const slideIndex = parseInt(slideFile.match(/slide([0-9]+)\.xml/)?.[1] || '0');
  console.log(`Slide index: ${slideIndex}`);

  // Parse the XML content
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(slideContent, "text/xml");
  
  if (!xmlDoc) {
    console.error("Failed to parse XML document");
    throw new Error("Failed to parse slide XML");
  }

  // Extract text content from paragraphs (similar to C# example)
  const textElements = xmlDoc.getElementsByTagName("a:t");
  const contentArray: string[] = [];
  
  for (const textElement of textElements) {
    const text = textElement.textContent?.trim();
    if (text) {
      console.log(`Found text content: ${text}`);
      contentArray.push(text);
    }
  }

  // Get slide title (usually the first text element in specific layouts)
  const title = contentArray[0] || `Slide ${slideIndex}`;
  
  // Extract shape data
  const shapes = xmlDoc.getElementsByTagName("p:sp");
  const shapeData = [];
  
  for (const shape of shapes) {
    const shapeType = shape.getElementsByTagName("p:nvSpPr")[0]?.textContent;
    const shapeText = shape.getElementsByTagName("a:t")[0]?.textContent;
    
    if (shapeType || shapeText) {
      shapeData.push({
        type: shapeType || "unknown",
        text: shapeText || ""
      });
    }
  }

  // Extract notes if they exist
  const notes: string[] = [];
  try {
    const notesXmlPath = slideFile.replace("slides/slide", "notesSlides/notesSlide");
    const notesContent = await zipContent.file(notesXmlPath)?.async("text");
    
    if (notesContent) {
      const notesDoc = parser.parseFromString(notesContent, "text/xml");
      const noteTexts = notesDoc.getElementsByTagName("a:t");
      
      for (const noteText of noteTexts) {
        const text = noteText.textContent?.trim();
        if (text) {
          notes.push(text);
        }
      }
    }
  } catch (error) {
    console.log(`No notes found for slide ${slideIndex}: ${error.message}`);
  }

  console.log(`Completed processing slide ${slideIndex}`);
  console.log(`Content array:`, contentArray);
  console.log(`Notes:`, notes);
  console.log(`Shapes:`, shapeData);

  return {
    index: slideIndex,
    title,
    content: contentArray,
    notes,
    shapes: shapeData
  };
}