import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { processSheet } from './extractors.ts';
import { convertToMarkdown } from './markdown.ts';
import { ProcessedContent } from './types.ts';

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

    console.log('Downloading file from URL:', fileUrl);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log('File downloaded successfully, size:', arrayBuffer.byteLength);

    if (arrayBuffer.byteLength === 0) {
      throw new Error('Downloaded file is empty');
    }

    const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
      type: 'array',
      cellFormulas: true,
      cellDates: true,
      cellNF: true,
    });

    console.log('XLSX file parsed successfully');

    const structuredContent: ProcessedContent = {
      metadata: {
        processedAt: new Date().toISOString(),
        sheetCount: workbook.SheetNames.length
      },
      slides: workbook.SheetNames.map((sheetName, index) => 
        processSheet(workbook.Sheets[sheetName], index)
      )
    };

    const { data: fileData } = await supabase
      .from('file_conversions')
      .select('pptx_path')
      .eq('id', fileId)
      .single();

    if (!fileData) {
      throw new Error('File record not found');
    }

    const jsonPath = fileData.pptx_path.replace('.pptx', '.json');
    const markdownPath = fileData.pptx_path.replace('.pptx', '.md');
    
    const markdown = convertToMarkdown(structuredContent);

    console.log('Uploading processed files');
    
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
        error_message: error instanceof Error ? error.message : "Unknown error occurred"
      })
      .eq('id', fileId);

    throw error;
  }
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
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});