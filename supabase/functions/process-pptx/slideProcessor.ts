import { FileData } from "./types.ts";

export async function processSlideContent(fileData: Blob): Promise<FileData> {
  try {
    // For now, we'll create a basic structure with the file data
    // Later we can enhance this with proper PPTX parsing
    const processedContent: FileData = {
      metadata: {
        processedAt: new Date().toISOString(),
        filename: 'presentation.pptx',
        slideCount: 1
      },
      slides: []
    };

    // Create a text decoder to read the file content
    const arrayBuffer = await fileData.arrayBuffer();
    const textDecoder = new TextDecoder();
    const content = textDecoder.decode(arrayBuffer);

    // Basic content extraction
    // Split content by what appears to be slide breaks
    const slideTexts = content.split(/(?:\r?\n){2,}/);
    
    slideTexts.forEach((text, index) => {
      if (text.trim()) {
        const lines = text.trim().split(/\r?\n/);
        const title = lines[0] || `Slide ${index + 1}`;
        const content = lines.slice(1).filter(line => line.trim());

        processedContent.slides.push({
          index: index + 1,
          title: title,
          content: content.length ? content : ["No content extracted"],
          notes: [],
          shapes: []
        });
      }
    });

    // Ensure we have at least one slide
    if (processedContent.slides.length === 0) {
      processedContent.slides.push({
        index: 1,
        title: "Slide 1",
        content: ["Content could not be extracted from this format"],
        notes: [],
        shapes: []
      });
    }

    // Update the slide count
    processedContent.metadata.slideCount = processedContent.slides.length;

    console.log("Processed content:", JSON.stringify(processedContent, null, 2));
    return processedContent;
  } catch (error) {
    console.error('Error processing PPTX content:', error);
    throw new Error(`Failed to process PPTX content: ${error.message}`);
  }
}