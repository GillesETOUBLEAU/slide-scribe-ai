import { ProcessedContent } from './types.ts';

export function convertToMarkdown(content: ProcessedContent): string {
  let markdown = `# Presentation Content\n\n`;
  markdown += `Processed at: ${content.metadata.processedAt}\n`;
  markdown += `Total Slides: ${content.metadata.sheetCount}\n\n`;

  content.slides.forEach(slide => {
    markdown += `## Slide ${slide.index}: ${slide.title}\n\n`;
    
    slide.content.forEach(text => {
      if (text?.trim()) {
        markdown += `${text}\n\n`;
      }
    });

    if (slide.notes.length > 0) {
      markdown += '### Notes\n\n';
      slide.notes.forEach(note => {
        markdown += `> ${note}\n\n`;
      });
    }

    if (slide.shapes.length > 0) {
      markdown += '### Shapes\n\n';
      slide.shapes.forEach(shape => {
        markdown += `- ${shape.type}: ${shape.text}\n`;
      });
      markdown += '\n';
    }
  });

  return markdown;
}