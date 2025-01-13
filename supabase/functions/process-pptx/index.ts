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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId, fileUrl } = await req.json();
    console.log('Processing request for file:', fileId);
    console.log('File URL:', fileUrl);

    if (!fileId || !fileUrl) {
      throw new Error('Missing required parameters');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update status to processing
    await supabase
      .from('file_conversions')
      .update({ status: 'processing' })
      .eq('id', fileId);

    // Download the file using the Supabase client instead of direct URL
    const bucketPath = fileUrl.split('/object/public/pptx_files/')[1];
    if (!bucketPath) {
      throw new Error('Invalid file URL format');
    }

    console.log('Downloading file from bucket path:', bucketPath);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pptx_files')
      .download(bucketPath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    if (!fileData) {
      throw new Error('No file data received');
    }

    console.log('File downloaded successfully, size:', fileData.size);

    // Convert Blob to ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer();
    
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

    const jsonPath = bucketPath.replace('.pptx', '.json');
    const markdownPath = bucketPath.replace('.pptx', '.md');
    
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
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Processing error:', error);
    
    // Only attempt to update the status if we have fileId
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
            error_message: error instanceof Error ? error.message : "Unknown error occurred"
          })
          .eq('id', fileId);
      }
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    return new Response(
      JSON.stringify({
        error: 'Processing failed',
        details: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});