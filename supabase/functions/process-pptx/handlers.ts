import { createClient } from "https://esm.sh/@supabase/supabase-js@1.35.7";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import type { FileData } from "./types.ts";

export async function handleFileProcessing(fileId: string, filePath: string) {
  console.log(`Starting processing for file: ${fileId}`);
  
  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Download the PPTX file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pptx_files')
      .download(filePath);

    if (downloadError) throw downloadError;

    // Process the file
    const processedData = await processFile(fileData);
    
    // Save JSON output
    const jsonPath = filePath.replace('.pptx', '.json');
    const jsonBlob = new Blob([JSON.stringify(processedData, null, 2)], {
      type: 'application/json',
    });
    
    const { error: jsonUploadError } = await supabase.storage
      .from('pptx_files')
      .upload(jsonPath, jsonBlob, { upsert: true });

    if (jsonUploadError) throw jsonUploadError;

    // Generate and save markdown
    const markdown = generateMarkdown(processedData);
    const markdownPath = filePath.replace('.pptx', '.md');
    const markdownBlob = new Blob([markdown], { type: 'text/markdown' });
    
    const { error: markdownUploadError } = await supabase.storage
      .from('pptx_files')
      .upload(markdownPath, markdownBlob, { upsert: true });

    if (markdownUploadError) throw markdownUploadError;

    // Update database record
    const { error: updateError } = await supabase
      .from('file_conversions')
      .update({
        status: 'completed',
        json_path: jsonPath,
        markdown_path: markdownPath,
      })
      .eq('id', fileId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    console.error('Error processing file:', error);

    // Update database record with error
    await supabase
      .from('file_conversions')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error occurred',
      })
      .eq('id', fileId);

    throw error;
  }
}

async function processFile(fileData: ArrayBuffer): Promise<FileData> {
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(fileData);
  
  // Process presentation content
  const slideEntries = Object.entries(zipContent.files)
    .filter(([name]) => name.startsWith('ppt/slides/slide'))
    .sort(([a], [b]) => a.localeCompare(b));

  const slides = await Promise.all(
    slideEntries.map(async ([name, file], index) => {
      const content = await file.async('string');
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/xml');
      
      return {
        index: index + 1,
        title: extractTitle(doc) || `Slide ${index + 1}`,
        content: extractContent(doc),
        notes: await extractNotes(zipContent, index + 1),
        shapes: extractShapes(doc)
      };
    })
  );

  return {
    metadata: {
      processedAt: new Date().toISOString(),
      filename: 'presentation.pptx',
      slideCount: slides.length,
    },
    slides,
  };
}

function extractTitle(doc: Document): string {
  const titleElement = doc.querySelector('p\\:title, title');
  return titleElement?.textContent?.trim() || '';
}

function extractContent(doc: Document): string[] {
  const textElements = doc.querySelectorAll('a\\:t');
  return Array.from(textElements)
    .map(el => el.textContent?.trim())
    .filter((text): text is string => !!text);
}

async function extractNotes(zip: JSZip, slideNumber: number): Promise<string[]> {
  const notesFile = zip.file(`ppt/notesSlides/notesSlide${slideNumber}.xml`);
  if (!notesFile) return [];

  const content = await notesFile.async('string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/xml');
  
  const noteElements = doc.querySelectorAll('a\\:t');
  return Array.from(noteElements)
    .map(el => el.textContent?.trim())
    .filter((text): text is string => !!text);
}

function extractShapes(doc: Document): { type: string; text: string; }[] {
  const shapes = doc.querySelectorAll('p\\:sp');
  return Array.from(shapes).map(shape => ({
    type: shape.querySelector('p\\:nvSpPr')?.textContent?.trim() || 'shape',
    text: shape.querySelector('a\\:t')?.textContent?.trim() || ''
  }));
}

function generateMarkdown(content: FileData): string {
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