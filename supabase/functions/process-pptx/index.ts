import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import pptxgen from 'https://esm.sh/pptxjs@3.12.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId, filePath } = await req.json();
    console.log('Starting processing for file:', fileId);
    console.log('File path:', filePath);

    if (!fileId || !filePath) {
      throw new Error('Missing required parameters: fileId and filePath are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Download the file
    console.log('Downloading file from storage...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pptx_files')
      .download(filePath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    if (!fileData) {
      throw new Error('No file data received');
    }

    console.log('File downloaded successfully, size:', fileData.size);

    // Process PPTX content using pptxjs
    const pptx = new pptxgen();
    const arrayBuffer = await fileData.arrayBuffer();
    await pptx.load(arrayBuffer);

    // Extract content from slides
    const slides = [];
    pptx.getSlides().forEach((slide, index) => {
      const slideContent = [];
      
      // Extract text from shapes
      slide.getShapes().forEach(shape => {
        if (shape.text) {
          slideContent.push(shape.text);
        }
      });

      slides.push({
        index: index + 1,
        title: `Slide ${index + 1}`,
        content: slideContent,
        notes: slide.getNotes() || [],
        shapes: []
      });
    });

    const structuredContent = {
      metadata: {
        processedAt: new Date().toISOString(),
        sheetCount: slides.length
      },
      slides
    };

    // Generate file paths
    const jsonPath = filePath.replace('.pptx', '.json');
    const markdownPath = filePath.replace('.pptx', '.md');
    
    console.log('Creating markdown content');
    const markdown = `# ${filePath.split('/').pop()?.replace('.pptx', '')}\n\n` +
      slides.map(slide => 
        `## ${slide.title}\n\n${slide.content.join('\n\n')}`
      ).join('\n\n');

    console.log('Uploading processed files');
    const [jsonUpload, markdownUpload] = await Promise.all([
      supabase.storage
        .from('pptx_files')
        .upload(jsonPath, JSON.stringify(structuredContent, null, 2), {
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

    console.log('Updating file status to completed');
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
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Processing error:', error);
    
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