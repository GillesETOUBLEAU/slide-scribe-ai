import { FileData } from "./types.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { extractSlideFiles, getSlideContent } from "./utils/zipHandler.ts";
import { processSlide } from "./utils/slideContentProcessor.ts";

export async function processSlideContent(fileData: Blob): Promise<FileData> {
  try {
    console.log("Starting PPTX processing");
    const arrayBuffer = await fileData.arrayBuffer();
    
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(arrayBuffer);
    console.log("PPTX file unzipped successfully");

    const slideFiles = await extractSlideFiles(zipContent);
    console.log(`Found ${slideFiles.length} slides`);

    const processedContent: FileData = {
      metadata: {
        processedAt: new Date().toISOString(),
        filename: 'presentation.pptx',
        slideCount: slideFiles.length
      },
      slides: []
    };

    for (const slideFile of slideFiles) {
      try {
        const slideContent = await getSlideContent(zipContent, slideFile);
        const slide = await processSlide(zipContent, slideFile, slideContent);
        processedContent.slides.push(slide);
        console.log(`Completed processing slide ${slide.index}`);
      } catch (error) {
        console.error(`Error processing slide ${slideFile}:`, error);
        const slideIndex = parseInt(slideFile.match(/slide([0-9]+)\.xml/)?.[1] || '0');
        processedContent.slides.push({
          index: slideIndex,
          title: `Slide ${slideIndex} (Error)`,
          content: [`Error processing slide: ${error.message}`],
          notes: [],
          shapes: []
        });
      }
    }

    // Ensure slides are sorted by index
    processedContent.slides.sort((a, b) => a.index - b.index);
    
    console.log("PPTX processing completed successfully");
    return processedContent;
  } catch (error) {
    console.error('Error processing PPTX content:', error);
    throw new Error(`Failed to process PPTX content: ${error.message}`);
  }
}