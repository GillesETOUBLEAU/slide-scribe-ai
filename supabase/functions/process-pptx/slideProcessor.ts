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
    console.log("Available files in PPTX:", Object.keys(zipContent.files));

    const processedContent: FileData = {
      metadata: {
        processedAt: new Date().toISOString(),
        filename: 'presentation.pptx',
        slideCount: 0
      },
      slides: []
    };

    // Process presentation.xml first to get metadata
    const presentationFile = zipContent.files['ppt/presentation.xml'];
    if (presentationFile) {
      const presentationContent = await presentationFile.async('string');
      console.log("Processing presentation.xml");
      const presentationDoc = parseXMLContent(presentationContent);
      console.log("Presentation structure:", JSON.stringify(presentationDoc, null, 2));
    }

    const slideFiles = Object.keys(zipContent.files)
      .filter(name => name.match(/ppt\/slides\/slide[0-9]+\.xml/))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide([0-9]+)\.xml/)?.[1] || '0');
        const numB = parseInt(b.match(/slide([0-9]+)\.xml/)?.[1] || '0');
        return numA - numB;
      });

    console.log("Found slide files:", slideFiles);
    processedContent.metadata.slideCount = slideFiles.length;

    for (const slideFile of slideFiles) {
      try {
        console.log(`\nProcessing ${slideFile}`);
        const slideContent = await zipContent.files[slideFile].async('string');
        console.log(`Raw slide content:`, slideContent);
        
        const xmlDoc = parseXMLContent(slideContent);
        console.log("Parsed XML structure:", JSON.stringify(xmlDoc, null, 2));
        
        const slideIndex = parseInt(slideFile.match(/slide([0-9]+)\.xml/)?.[1] || '0');
        
        // Extract title
        const title = findTitle(xmlDoc) || `Slide ${slideIndex}`;
        console.log(`Slide ${slideIndex} title:`, title);
        
        // Extract all text content
        const content = extractTextContent(xmlDoc);
        console.log(`Slide ${slideIndex} extracted content:`, content);
        
        // Extract shapes
        const shapes = extractShapes(xmlDoc);
        console.log(`Found ${shapes.length} shapes in slide ${slideIndex}`);
        
        // Extract notes
        const notes = await extractNotes(zipContent, slideIndex);
        console.log(`Found ${notes.length} notes in slide ${slideIndex}`);
        
        // Filter out title from content to avoid duplication
        const slideContent = content.filter(text => text !== title);
        console.log(`Final slide ${slideIndex} content:`, slideContent);

        processedContent.slides.push({
          index: slideIndex,
          title,
          content: slideContent,
          notes,
          shapes
        });

        console.log(`Completed processing slide ${slideIndex}`);
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
    console.log("Processed content:", JSON.stringify(processedContent, null, 2));
    return processedContent;
  } catch (error) {
    console.error('Error processing PPTX content:', error);
    throw new Error(`Failed to process PPTX content: ${error.message}`);
  }
}