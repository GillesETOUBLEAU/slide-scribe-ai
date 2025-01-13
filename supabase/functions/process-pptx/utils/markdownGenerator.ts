import { FileData } from "../types.ts";

export function generateMarkdown(content: FileData): string {
  let markdown = `# Presentation Content\n\n`;
  markdown += `Processed at: ${content.metadata.processedAt}\n\n`;

  content.slides.forEach((slide) => {
    markdown += `## Slide ${slide.index}: ${slide.title}\n\n`;
    
    // Add content
    slide.content.forEach((text) => {
      markdown += `${text}\n\n`;
    });

    // Add notes if present
    if (slide.notes.length > 0) {
      markdown += `### Notes\n\n`;
      slide.notes.forEach((note) => {
        markdown += `- ${note}\n`;
      });
      markdown += '\n';
    }

    // Add shapes if present
    if (slide.shapes.length > 0) {
      markdown += `### Shapes\n\n`;
      slide.shapes.forEach((shape) => {
        markdown += `- ${shape.type}: ${shape.text}\n`;
      });
      markdown += '\n';
    }
  });

  return markdown;
}