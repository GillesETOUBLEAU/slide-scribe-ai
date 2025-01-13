import { FileData } from "./types.ts";
import { unzip } from "https://deno.land/x/zip@v1.2.5/mod.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

export async function processSlideContent(fileData: Blob): Promise<FileData> {
  try {
    console.log("Starting PPTX processing");
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Unzip the PPTX file
    const unzipped = await unzip(uint8Array);
    console.log("PPTX file unzipped successfully");

    const processedContent: FileData = {
      metadata: {
        processedAt: new Date().toISOString(),
        filename: 'presentation.pptx',
        slideCount: 0
      },
      slides: []
    };

    const parser = new DOMParser();
    const slideFiles = Object.keys(unzipped).filter(name => 
      name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
    ).sort();

    console.log(`Found ${slideFiles.length} slides`);
    processedContent.metadata.slideCount = slideFiles.length;

    for (const [index, slideFile] of slideFiles.entries()) {
      console.log(`Processing slide ${index + 1}: ${slideFile}`);
      const slideContent = new TextDecoder().decode(unzipped[slideFile]);
      const doc = parser.parseFromString(slideContent, 'text/xml');
      
      if (!doc) {
        console.warn(`Could not parse slide ${index + 1}`);
        continue;
      }

      // Extract text content
      const textElements = doc.querySelectorAll('a\\:t');
      const textContents = Array.from(textElements)
        .map(el => el.textContent?.trim())
        .filter((text): text is string => !!text);

      // First text element is usually the title
      const title = textContents[0] || `Slide ${index + 1}`;
      const content = textContents.slice(1);

      // Extract shapes
      const shapes = Array.from(doc.querySelectorAll('p\\:sp')).map(shape => {
        const nvSpPr = shape.querySelector('p\\:nvSpPr');
        const txBody = shape.querySelector('p\\:txBody');
        return {
          type: nvSpPr?.textContent?.trim() || 'shape',
          text: txBody?.textContent?.trim() || ''
        };
      });

      // Try to get notes
      const notesFile = `ppt/notesSlides/notesSlide${index + 1}.xml`;
      let notes: string[] = [];
      if (unzipped[notesFile]) {
        const notesContent = new TextDecoder().decode(unzipped[notesFile]);
        const notesDoc = parser.parseFromString(notesContent, 'text/xml');
        if (notesDoc) {
          const noteElements = notesDoc.querySelectorAll('a\\:t');
          notes = Array.from(noteElements)
            .map(el => el.textContent?.trim())
            .filter((text): text is string => !!text);
        }
      }

      processedContent.slides.push({
        index: index + 1,
        title,
        content,
        notes,
        shapes
      });

      console.log(`Completed processing slide ${index + 1}`);
    }

    // Ensure we have at least one slide
    if (processedContent.slides.length === 0) {
      console.log("No slides found, adding default slide");
      processedContent.slides.push({
        index: 1,
        title: "Slide 1",
        content: ["No content could be extracted from this presentation"],
        notes: [],
        shapes: []
      });
      processedContent.metadata.slideCount = 1;
    }

    console.log("PPTX processing completed successfully");
    return processedContent;
  } catch (error) {
    console.error('Error processing PPTX content:', error);
    throw new Error(`Failed to process PPTX content: ${error.message}`);
  }
}