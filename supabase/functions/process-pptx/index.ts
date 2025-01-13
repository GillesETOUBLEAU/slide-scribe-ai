import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function processFile(supabase: any, fileId: string, fileUrl: string) {
  console.log('Starting file processing:', fileId);
  
  try {
    // Update status to processing
    await supabase
      .from('file_conversions')
      .update({ status: 'processing' })
      .eq('id', fileId);

    // Download the file
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('Failed to download file');
    
    const arrayBuffer = await response.arrayBuffer();
    console.log('File downloaded, size:', arrayBuffer.byteLength);

    // Process the file
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
      type: 'array',
      cellFormulas: true,
      cellDates: true,
      cellNF: true,
    });

    const structuredContent = {
      metadata: {
        processedAt: new Date().toISOString(),
        sheetCount: workbook.SheetNames.length
      },
      slides: workbook.SheetNames.map((sheetName, index) => {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        return {
          index: index + 1,
          title: extractSlideTitle(sheet),
          content: data.flat().filter(cell => cell && typeof cell === 'string'),
          notes: extractNotes(sheet),
          shapes: extractShapes(sheet)
        };
      })
    };

    // Generate file paths
    const { data: fileData } = await supabase
      .from('file_conversions')
      .select('pptx_path')
      .eq('id', fileId)
      .single();

    const jsonPath = fileData.pptx_path.replace('.pptx', '.json');
    const markdownPath = fileData.pptx_path.replace('.pptx', '.md');
    
    // Generate markdown
    const markdown = convertToMarkdown(structuredContent);

    // Upload processed files
    await Promise.all([
      supabase.storage
        .from('pptx_files')
        .upload(jsonPath, JSON.stringify(structuredContent), {
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

    // Update status to completed
    await supabase
      .from('file_conversions')
      .update({
        status: 'completed',
        json_path: jsonPath,
        markdown_path: markdownPath
      })
      .eq('id', fileId);

    console.log('Processing completed successfully');
    return { success: true };

  } catch (error) {
    console.error('Processing error:', error);
    
    await supabase
      .from('file_conversions')
      .update({
        status: 'error',
        error_message: error.message
      })
      .eq('id', fileId);

    throw error;
  }
}

function extractSlideTitle(sheet: XLSX.WorkSheet): string {
  // Look for title in first few cells
  const titleCells = ['A1', 'B1', 'C1'];
  for (const cell of titleCells) {
    if (sheet[cell] && sheet[cell].v) {
      return String(sheet[cell].v);
    }
  }
  return 'Untitled Slide';
}

function extractNotes(sheet: XLSX.WorkSheet): string[] {
  const notes: string[] = [];
  // Look for notes in comments
  if (sheet['!comments']) {
    Object.values(sheet['!comments']).forEach(comment => {
      if (comment.t) notes.push(comment.t);
    });
  }
  return notes;
}

function extractShapes(sheet: XLSX.WorkSheet): Array<{ type: string; text: string }> {
  const shapes: Array<{ type: string; text: string }> = [];
  // Extract shapes from drawings if available
  if (sheet['!drawings']) {
    sheet['!drawings'].forEach((drawing: any) => {
      if (drawing.shape) {
        shapes.push({
          type: drawing.shape.type || 'unknown',
          text: drawing.shape.text || ''
        });
      }
    });
  }
  return shapes;
}

function convertToMarkdown(content: any): string {
  let markdown = `# Presentation Content\n\n`;
  markdown += `Processed at: ${content.metadata.processedAt}\n`;
  markdown += `Total Slides: ${content.metadata.sheetCount}\n\n`;

  content.slides.forEach((slide: any) => {
    markdown += `## Slide ${slide.index}: ${slide.title}\n\n`;
    
    slide.content.forEach((text: string) => {
      if (text?.trim()) {
        markdown += `${text}\n\n`;
      }
    });

    if (slide.notes.length > 0) {
      markdown += '### Notes\n\n';
      slide.notes.forEach((note: string) => {
        markdown += `> ${note}\n\n`;
      });
    }

    if (slide.shapes.length > 0) {
      markdown += '### Shapes\n\n';
      slide.shapes.forEach((shape: any) => {
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
    const { fileId, fileUrl } = await req.json();
    console.log('Processing request for file:', fileId);

    if (!fileId || !fileUrl) {
      throw new Error('Missing required parameters');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const result = await processFile(supabase, fileId, fileUrl);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
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