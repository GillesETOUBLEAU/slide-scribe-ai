import { createSupabaseClient, getFileData, downloadPPTX, uploadFile, updateFileStatus } from "./utils.ts";
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

export async function processFile(fileId: string) {
  const supabase = createSupabaseClient();
  
  try {
    // Update status to processing
    await updateFileStatus(supabase, fileId, 'processing');
    
    // Get file data
    const fileData = await getFileData(supabase, fileId);
    
    // Download PPTX in chunks
    const fileContent = await downloadPPTX(supabase, fileData.pptx_path);
    
    // Process content with memory-efficient approach
    const workbook = XLSX.read(new Uint8Array(await fileContent.arrayBuffer()), {
      type: 'array',
      cellFormulas: false, // Disable formula parsing to save memory
      cellStyles: false,   // Disable style parsing to save memory
      cellNF: false,       // Disable number format parsing
      cellDates: false,    // Disable date parsing
    });

    const processedContent = {
      metadata: {
        lastModified: new Date().toISOString(),
        sheetCount: workbook.SheetNames.length
      },
      slides: workbook.SheetNames.map((sheetName, index) => {
        const sheet = workbook.Sheets[sheetName];
        const textContent = XLSX.utils.sheet_to_json(sheet, { 
          header: 1,
          raw: false // Convert everything to strings to save memory
        }).flat().filter(cell => cell);

        return {
          index: index + 1,
          name: sheetName,
          content: textContent
        };
      })
    };

    // Generate file paths
    const jsonPath = fileData.pptx_path.replace('.pptx', '.json');
    const markdownPath = fileData.pptx_path.replace('.pptx', '.md');

    // Create markdown content
    const markdownContent = generateMarkdown(processedContent);

    // Upload processed files
    await Promise.all([
      uploadFile(
        supabase,
        'pptx_files',
        jsonPath,
        new Blob([JSON.stringify(processedContent)], { type: 'application/json' })
      ),
      uploadFile(
        supabase,
        'pptx_files',
        markdownPath,
        new Blob([markdownContent], { type: 'text/markdown' })
      )
    ]);

    // Update file status to completed
    await updateFileStatus(supabase, fileId, 'completed', {
      json_path: jsonPath,
      markdown_path: markdownPath
    });

    return { jsonPath, markdownPath };
  } catch (error) {
    console.error('Error processing file:', error);
    
    // Update status to error
    await updateFileStatus(supabase, fileId, 'error', {
      error_message: error.message
    });
    
    throw error;
  }
}

function generateMarkdown(content: any): string {
  let markdown = `# Presentation Content\n\n`;
  markdown += `Last Modified: ${content.metadata.lastModified}\n\n`;

  content.slides.forEach((slide: any) => {
    markdown += `## Slide ${slide.index}: ${slide.name}\n\n`;
    
    slide.content.forEach((text: string) => {
      if (text?.trim()) {
        markdown += `${text}\n\n`;
      }
    });
  });

  return markdown;
}