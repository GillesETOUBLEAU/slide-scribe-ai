import { FileData } from "./types.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { parse as parseXML } from "https://deno.land/x/xml@2.1.3/mod.ts";

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
      const xmlDoc = parseXML(slideContent);
      
      if (!xmlDoc) {
        console.warn(`Could not parse slide ${index + 1}`);
        continue;
      }

      // Extract all text content recursively
      const textContents: string[] = [];
      const walkTextContent = (node: any) => {
        if (node.name === 'a:t' && node.content) {
          const text = Array.isArray(node.content) 
            ? node.content.join('').trim()
            : String(node.content).trim();
          if (text) textContents.push(text);
        }
        if (node.children) {
          node.children.forEach(walkTextContent);
        }
      };

      // Find the title specifically (usually in p:title or p:cSld//p:title)
      let title = `Slide ${index + 1}`;
      const findTitle = (node: any): boolean => {
        if (node.name === 'p:title' || node.name === 'p:cSld') {
          const titleTexts: string[] = [];
          const walkTitleNode = (n: any) => {
            if (n.name === 'a:t' && n.content) {
              const text = Array.isArray(n.content) 
                ? n.content.join('').trim()
                : String(n.content).trim();
              if (text) titleTexts.push(text);
            }
            if (n.children) {
              n.children.forEach(walkTitleNode);
            }
          };
          walkTitleNode(node);
          if (titleTexts.length > 0) {
            title = titleTexts.join(' ');
            return true;
          }
        }
        if (node.children) {
          for (const child of node.children) {
            if (findTitle(child)) return true;
          }
        }
        return false;
      };

      // Process the entire slide content
      walkTextContent(xmlDoc);
      findTitle(xmlDoc);

      // Extract shapes
      const shapes: Array<{ type: string; text: string }> = [];
      const walkShapes = (node: any) => {
        if (node.name === 'p:sp') {
          let shapeType = 'shape';
          let shapeText = '';
          
          // Try to find shape type from nvSpPr
          const findShapeType = (n: any) => {
            if (n.name === 'p:nvSpPr' || n.name === 'p:cNvPr') {
              if (n.attributes?.name) {
                shapeType = n.attributes.name;
              }
            }
            if (n.children) {
              n.children.forEach(findShapeType);
            }
          };
          
          // Find shape text content
          const findShapeText = (n: any) => {
            if (n.name === 'a:t' && n.content) {
              const text = Array.isArray(n.content) 
                ? n.content.join('').trim()
                : String(n.content).trim();
              if (text) shapeText = text;
            }
            if (n.children) {
              n.children.forEach(findShapeText);
            }
          };
          
          findShapeType(node);
          findShapeText(node);
          
          if (shapeText) {
            shapes.push({ type: shapeType, text: shapeText });
          }
        }
        if (node.children) {
          node.children.forEach(walkShapes);
        }
      };
      walkShapes(xmlDoc);

      // Extract notes
      const notesFile = `ppt/notesSlides/notesSlide${index + 1}.xml`;
      let notes: string[] = [];
      if (zipContent.files[notesFile]) {
        const notesContent = await zipContent.files[notesFile].async('string');
        const notesDoc = parseXML(notesContent);
        if (notesDoc) {
          const walkNotes = (node: any) => {
            if (node.name === 'a:t' && node.content) {
              const text = Array.isArray(node.content) 
                ? node.content.join('').trim()
                : String(node.content).trim();
              if (text) notes.push(text);
            }
            if (node.children) {
              node.children.forEach(walkNotes);
            }
          };
          walkNotes(notesDoc);
        }
      }

      // Remove title from content if it exists
      const contentWithoutTitle = textContents.filter(text => text !== title);

      processedContent.slides.push({
        index: index + 1,
        title,
        content: contentWithoutTitle,
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