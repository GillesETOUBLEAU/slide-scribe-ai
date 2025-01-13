import { Slide } from "../types.ts";
import { parseXMLContent, extractTextContent, findTitle } from "./xmlParser.ts";
import { extractShapes } from "./shapeExtractor.ts";
import { extractNotes } from "./notesExtractor.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

export async function processSlide(
  zipContent: JSZip,
  slideFile: string,
  slideContent: string
): Promise<Slide> {
  console.log(`\nProcessing ${slideFile}`);
  
  const xmlDoc = parseXMLContent(slideContent);
  console.log("XML document structure:", JSON.stringify(xmlDoc, null, 2));
  
  const slideIndex = parseInt(slideFile.match(/slide([0-9]+)\.xml/)?.[1] || '0');
  console.log(`Processing slide ${slideIndex}`);

  // Extract all text content first
  const allTextContent = extractTextContent(xmlDoc);
  console.log(`All text content from slide ${slideIndex}:`, allTextContent);
  
  // Find title (usually first shape or specific placeholder)
  const title = findTitle(xmlDoc) || `Slide ${slideIndex}`;
  console.log(`Title for slide ${slideIndex}:`, title);
  
  // Filter out title from content to avoid duplication
  const content = allTextContent.filter(text => text !== title);
  console.log(`Content for slide ${slideIndex}:`, content);
  
  // Extract shapes
  const shapes = extractShapes(xmlDoc);
  console.log(`Shapes for slide ${slideIndex}:`, shapes);
  
  // Extract notes
  const notes = await extractNotes(zipContent, slideIndex);
  console.log(`Notes for slide ${slideIndex}:`, notes);

  return {
    index: slideIndex,
    title,
    content,
    notes,
    shapes
  };
}