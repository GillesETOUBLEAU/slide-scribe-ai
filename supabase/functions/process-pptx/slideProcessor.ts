import { FileData } from "./types.ts";
import * as pptxgen from 'https://esm.sh/pptxgenjs@3.12.0';

export async function processSlideContent(fileData: Blob): Promise<FileData> {
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const pptx = new pptxgen();
    await pptx.load(arrayBuffer);

    const slides = pptx.getSlides();
    
    const processedContent: FileData = {
      metadata: {
        processedAt: new Date().toISOString(),
        filename: 'presentation.pptx',
        slideCount: slides.length
      },
      slides: []
    };

    slides.forEach((slide, index) => {
      const slideContent = {
        index: index + 1,
        title: "",
        content: [] as string[],
        notes: slide.notes ? [slide.notes] : [],
        shapes: []
      };

      // Extract text from shapes
      slide.shapes.forEach(shape => {
        if (shape.text) {
          if (!slideContent.title) {
            slideContent.title = shape.text;
          } else {
            slideContent.content.push(shape.text);
          }

          slideContent.shapes.push({
            type: shape.type || 'text',
            text: shape.text
          });
        }
      });

      // If no title was found, use a default one
      if (!slideContent.title) {
        slideContent.title = `Slide ${index + 1}`;
      }

      processedContent.slides.push(slideContent);
    });

    return processedContent;
  } catch (error) {
    console.error('Error processing PPTX content:', error);
    throw new Error(`Failed to process PPTX content: ${error.message}`);
  }
}