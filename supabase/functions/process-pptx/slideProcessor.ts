import { FileData } from "./types.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { parseXMLContent, extractTextContent, findTitle } from "./utils/xmlParser.ts";
import { extractShapes } from "./utils/shapeExtractor.ts";
import { extractNotes } from "./utils/notesExtractor.ts";

export async function processSlideContent(fileData: Blob): Promise<FileData> {
  try {
    console.log("Starting PPTX processing");
    const arrayBuffer = await fileData.arrayBuffer();
    
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(arrayBuffer);
    console.log("PPTX file unzipped successfully");

    const processedContent: FileData = {
      metadata: {
        processedAt: new Date().toISOString(),
        filename: 'presentation.pptx',
        slideCount: 0
      },
      slides: []
    };

    const slideFiles = Object.keys(zipContent.files)
      .filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
      .sort();

    console.log(`Found ${slideFiles.length} slides`);
    processedContent.metadata.slideCount = slideFiles.length;

    for (const [index, slideFile] of slideFiles.entries()) {
      console.log(`Processing slide ${index + 1}: ${slideFile}`);
      const slideContent = await zipContent.files[slideFile].async('string');
      const xmlDoc = parseXMLContent(slideContent);

      const title = findTitle(xmlDoc) || `Slide ${index + 1}`;
      const content = extractTextContent(xmlDoc).filter(text => text !== title);
      const notes = await extractNotes(zipContent, index + 1);
      const shapes = extractShapes(xmlDoc);

      processedContent.slides.push({
        index: index + 1,
        title,
        content,
        notes,
        shapes
      });

      console.log(`Completed processing slide ${index + 1}`);
    }

    // Add default slide if no slides were found
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