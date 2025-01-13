import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { processSlides } from "./slideProcessor.ts";
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

  const slides = await processSlides(slideEntries, zipContent);

  return {
    metadata: {
      processedAt: new Date().toISOString(),
      filename: 'presentation.pptx',
      slideCount: slides.length,
    },
    slides,
  };
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