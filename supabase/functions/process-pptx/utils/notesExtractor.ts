import { parseXMLContent, extractTextContent } from "./xmlParser.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

export async function extractNotes(zipContent: JSZip, slideIndex: number): Promise<string[]> {
  const notesFile = `ppt/notesSlides/notesSlide${slideIndex}.xml`;
  let notes: string[] = [];
  
  try {
    if (zipContent.files[notesFile]) {
      const notesContent = await zipContent.files[notesFile].async('string');
      const notesDoc = parseXMLContent(notesContent);
      
      // Extract notes from specific notes-related elements
      function walkNotesContent(node: any) {
        if (node.name === 'p:sp') {
          const texts = extractTextContent(node);
          if (texts.length > 0) {
            notes.push(...texts);
          }
        }
        
        if (node.children) {
          node.children.forEach(walkNotesContent);
        }
      }
      
      if (notesDoc) {
        walkNotesContent(notesDoc);
      }
    }
  } catch (error) {
    console.error(`Error extracting notes for slide ${slideIndex}:`, error);
  }
  
  return notes;
}