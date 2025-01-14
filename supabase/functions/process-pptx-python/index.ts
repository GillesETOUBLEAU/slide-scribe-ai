import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

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
    // Get request body
    const { fileId, filePath } = await req.json();
    
    if (!fileId || !filePath) {
      throw new Error('Missing required parameters');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log('Downloading file:', filePath);
    
    // Download the file
    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from('pptx_files')
      .download(filePath);

    if (downloadError) {
      throw new Error(`Error downloading file: ${downloadError.message}`);
    }

    // Process the PPTX file
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(fileData);

    // Extract content
    const slideContents = [];
    const slideFiles = Object.keys(zipContent.files).filter(name => 
      name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
    );

    for (const slideFile of slideFiles) {
      const content = await zipContent.files[slideFile].async('text');
      slideContents.push({
        slide: parseInt(slideFile.match(/slide(\d+)\.xml/)?.[1] || '0'),
        content: content
      });
    }

    // Generate JSON and Markdown
    const jsonContent = JSON.stringify(slideContents, null, 2);
    const markdownContent = slideContents
      .map(slide => `## Slide ${slide.slide}\n\n${slide.content}`)
      .join('\n\n');

    // Save processed files
    const jsonPath = `${filePath.replace('.pptx', '.json')}`;
    const markdownPath = `${filePath.replace('.pptx', '.md')}`;

    console.log('Uploading processed files');

    // Upload JSON
    const { error: jsonUploadError } = await supabaseClient
      .storage
      .from('pptx_files')
      .upload(jsonPath, new Blob([jsonContent], { type: 'application/json' }));

    if (jsonUploadError) {
      throw new Error(`Error uploading JSON: ${jsonUploadError.message}`);
    }

    // Upload Markdown
    const { error: mdUploadError } = await supabaseClient
      .storage
      .from('pptx_files')
      .upload(markdownPath, new Blob([markdownContent], { type: 'text/markdown' }));

    if (mdUploadError) {
      throw new Error(`Error uploading Markdown: ${mdUploadError.message}`);
    }

    // Update database record
    const { error: updateError } = await supabaseClient
      .from('file_conversions')
      .update({
        status: 'completed',
        json_path: jsonPath,
        markdown_path: markdownPath
      })
      .eq('id', fileId);

    if (updateError) {
      throw new Error(`Error updating database: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Processing error:', error);

    // Update database record with error
    if (error instanceof Error) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      );

      await supabaseClient
        .from('file_conversions')
        .update({
          status: 'error',
          error_message: error.message
        })
        .eq('id', (await req.json()).fileId);
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }),
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});