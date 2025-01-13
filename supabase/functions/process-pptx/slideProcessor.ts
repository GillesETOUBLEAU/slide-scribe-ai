import JSZip from "https://esm.sh/jszip@3.10.1";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import type { FileData, Slide } from "./types.ts";

export async function processSlideContent(fileData: Blob): Promise<FileData> {
  const arrayBuffer = await fileData.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const structuredContent: FileData = {
    metadata: {
      processedAt: new Date().toISOString(),
      filename: '',
      slideCount: 0
    },
    slides: []
  };

  // Get presentation.xml for metadata
  const presentationXml = await zip.file("ppt/presentation.xml")?.async("string");
  if (presentationXml) {
    const parser = new DOMParser();
    const presentationDoc = parser.parseFromString(presentationXml, "text/html");
    const slideElements = presentationDoc.getElementsByTagName("p:sld");
    structuredContent.metadata.slideCount = slideElements.length;
  }

  // Process each slide
  const slidePromises: Promise<Slide>[] = [];
  zip.folder("ppt/slides/")?.forEach((relativePath, zipEntry) => {
    if (relativePath.startsWith("slide") && relativePath.endsWith(".xml")) {
      const slidePromise = processSlide(zip, zipEntry);
      slidePromises.push(slidePromise);
    }
  });

  structuredContent.slides = await Promise.all(slidePromises);
  structuredContent.slides.sort((a, b) => a.index - b.index);

  return structuredContent;
}

async function processSlide(zip: JSZip, zipEntry: JSZip.JSZipObject): Promise<Slide> {
  const slideContent = await zipEntry.async("string");
  const parser = new DOMParser();
  const slideDoc = parser.parseFromString(slideContent, "text/html");
  
  const slideIndex = parseInt(zipEntry.name.match(/slide(\d+)\.xml/)?.[1] || "0");
  
  const slide: Slide = {
    index: slideIndex,
    title: "",
    content: [],
    notes: [],
    shapes: []
  };

  // Extract text content
  const textElements = slideDoc.getElementsByTagName("a:t");
  for (let i = 0; i < textElements.length; i++) {
    const textElement = textElements[i];
    const text = textElement.textContent?.trim();
    if (text) {
      if (!slide.title) {
        slide.title = text;
      } else {
        slide.content.push(text);
      }
    }
  }

  // Get slide notes if they exist
  const notesPath = `ppt/notesSlides/notesSlide${slideIndex}.xml`;
  const notesFile = zip.file(notesPath);
  if (notesFile) {
    const notesContent = await notesFile.async("string");
    const notesDoc = parser.parseFromString(notesContent, "text/html");
    const noteElements = notesDoc.getElementsByTagName("a:t");
    for (let i = 0; i < noteElements.length; i++) {
      const noteElement = noteElements[i];
      const noteText = noteElement.textContent?.trim();
      if (noteText) {
        slide.notes.push(noteText);
      }
    }
  }

  return slide;
}