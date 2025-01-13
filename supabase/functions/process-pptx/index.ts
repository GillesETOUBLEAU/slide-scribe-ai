import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Download the PPTX file directly from storage
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

    // Generate paths for processed files
    const jsonPath = fileData.pptx_path.replace('.pptx', '.json');
    const markdownPath = fileData.pptx_path.replace('.pptx', '.md');

    // Process PPTX content (simplified example)
    const processedContent = {
      metadata: {
        filename: fileData.original_filename,
        processedAt: new Date().toISOString()
      },
      slides: [
        {
          index: 1,
          title: "Example Slide",
          content: "This is placeholder content as PPTX processing is not implemented yet"
        }
      ]
    };

    // Generate markdown content
    const markdownContent = `# ${fileData.original_filename}\n\nProcessed at: ${new Date().toISOString()}\n\n## Slide 1\n\nThis is placeholder content as PPTX processing is not implemented yet`;

    console.log('Uploading processed files');

    // Upload processed files
    const [jsonUpload, markdownUpload] = await Promise.all([
      supabase.storage
        .from('pptx_files')
        .upload(jsonPath, JSON.stringify(processedContent), {
          contentType: 'application/json',
          upsert: true
        }),
      supabase.storage
        .from('pptx_files')
        .upload(markdownPath, markdownContent, {
          contentType: 'text/markdown',
          upsert: true
        })
    ]);

    if (jsonUpload.error) throw jsonUpload.error;
    if (markdownUpload.error) throw markdownUpload.error;

    console.log('Files uploaded successfully');

    // Update file status
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

    // Update file status to error
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