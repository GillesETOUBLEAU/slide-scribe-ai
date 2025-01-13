import { parseXMLContent, extractTextContent } from "./xmlParser.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

export async function extractNotes(zipContent: JSZip, slideIndex: number): Promise<string[]> {
  const notesFile = `ppt/notesSlides/notesSlide${slideIndex}.xml`;
  let notes: string[] = [];
  
  if (zipContent.files[notesFile]) {
    const notesContent = await zipContent.files[notesFile].async('string');
    const notesDoc = parseXMLContent(notesContent);
    if (notesDoc) {
      notes = extractTextContent(notesDoc);
    }
  }
  
  return notes;
}