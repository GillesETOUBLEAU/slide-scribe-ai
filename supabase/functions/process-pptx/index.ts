import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function extractPPTXContent(arrayBuffer: ArrayBuffer, filename: string) {
  try {
    // Read the PPTX file
    const workbook = XLSX.read(arrayBuffer, {
      cellStyles: true,
      cellFormulas: true,
      cellDates: true,
      cellNF: true,
      sheetStubs: true
    });

    // Initialize the structured content
    const structuredContent = {
      metadata: {
        filename: filename,
        processedAt: new Date().toISOString(),
      },
      slides: [] as any[]
    };

    // Process each sheet (slide)
    workbook.SheetNames.forEach((sheetName, index) => {
      const sheet = workbook.Sheets[sheetName];
      const slideContent = {
        index: index + 1,
        title: extractSlideTitle(sheet),
        content: [],
        notes: extractNotes(sheet),
        shapes: extractShapes(sheet)
      };

      // Extract text content
      const textContent = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        .flat()
        .filter(cell => cell && typeof cell === 'string');

      slideContent.content = textContent;
      structuredContent.slides.push(slideContent);
    });

    return {
      json: structuredContent,
      markdown: convertToMarkdown(structuredContent)
    };
  } catch (error) {
    console.error('Error processing PPTX:', error);
    throw error;
  }
}

function extractSlideTitle(sheet: XLSX.WorkSheet): string {
  // Attempt to find title in common locations
  const titleCells = ['A1', 'B1', 'C1'];
  for (const cell of titleCells) {
    if (sheet[cell] && sheet[cell].v) {
      return sheet[cell].v.toString();
    }
  }
  return 'Untitled Slide';
}

function extractNotes(sheet: XLSX.WorkSheet): string[] {
  // Look for notes in the sheet's comments or specific cells
  const notes: string[] = [];
  if (sheet['!comments']) {
    Object.values(sheet['!comments']).forEach(comment => {
      if (comment.t) notes.push(comment.t);
    });
  }
  return notes;
}

function extractShapes(sheet: XLSX.WorkSheet): Array<{ type: string; text: string }> {
  // Extract shape data if available
  const shapes: Array<{ type: string; text: string }> = [];
  if (sheet['!drawings']) {
    sheet['!drawings'].forEach((drawing: any) => {
      if (drawing.shape) {
        shapes.push({
          type: drawing.shape.type,
          text: drawing.shape.text || ''
        });
      }
    });
  }
  return shapes;
}

function convertToMarkdown(structuredContent: any): string {
  let markdown = `# ${structuredContent.metadata.filename}\n\n`;

  structuredContent.slides.forEach((slide: any) => {
    markdown += `## Slide ${slide.index}: ${slide.title}\n\n`;

    // Add content
    slide.content.forEach((text: string) => {
      if (text.trim()) {
        markdown += `${text}\n\n`;
      }
    });

    // Add notes if present
    if (slide.notes.length > 0) {
      markdown += '### Notes\n\n';
      slide.notes.forEach((note: string) => {
        markdown += `> ${note}\n\n`;
      });
    }

    // Add shapes if present
    if (slide.shapes.length > 0) {
      markdown += '### Shapes\n\n';
      slide.shapes.forEach((shape: { type: string; text: string }) => {
        markdown += `- ${shape.type}: ${shape.text}\n`;
      });
      markdown += '\n';
    }
  });

  return markdown;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId } = await req.json();
    console.log('Processing file:', fileId);

    if (!fileId) {
      throw new Error('Missing required parameters');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get file data
    const { data: fileData, error: fileError } = await supabase
      .from('file_conversions')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError) throw fileError;
    
    console.log('File data retrieved:', fileData);

    // Download the PPTX file
    const { data: fileContent, error: downloadError } = await supabase.storage
      .from('pptx_files')
      .download(fileData.pptx_path);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    if (!fileContent) {
      throw new Error('No file content received');
    }

    console.log('File downloaded successfully, size:', fileContent.size);

    // Process the PPTX content
    const arrayBuffer = await fileContent.arrayBuffer();
    const { json, markdown } = await extractPPTXContent(arrayBuffer, fileData.original_filename);

    // Generate paths for processed files
    const jsonPath = fileData.pptx_path.replace('.pptx', '.json');
    const markdownPath = fileData.pptx_path.replace('.pptx', '.md');

    console.log('Uploading processed files');

    // Upload processed files
    const [jsonUpload, markdownUpload] = await Promise.all([
      supabase.storage
        .from('pptx_files')
        .upload(jsonPath, JSON.stringify(json), {
          contentType: 'application/json',
          upsert: true
        }),
      supabase.storage
        .from('pptx_files')
        .upload(markdownPath, markdown, {
          contentType: 'text/markdown',
          upsert: true
        })
    ]);

    if (jsonUpload.error) throw jsonUpload.error;
    if (markdownUpload.error) throw markdownUpload.error;

    console.log('Files uploaded successfully');

    // Update file status to completed
    const { error: updateError } = await supabase
      .from('file_conversions')
      .update({
        status: 'completed',
        json_path: jsonPath,
        markdown_path: markdownPath
      })
      .eq('id', fileId);

    if (updateError) throw updateError;

    console.log('Processing completed successfully');

    return new Response(
      JSON.stringify({ status: 'success' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Processing error:', error);

    // Update file status to error if we have the fileId
    try {
      const { fileId } = await req.json();
      if (fileId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabase
          .from('file_conversions')
          .update({
            status: 'error',
            error_message: error.message
          })
          .eq('id', fileId);
      }
    } catch (e) {
      console.error('Failed to update error status:', e);
    }

    return new Response(
      JSON.stringify({
        error: 'Processing failed',
        details: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});