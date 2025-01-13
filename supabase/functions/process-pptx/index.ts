import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { processSlideContent } from "./slideProcessor.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  console.log("Received request:", req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    // Parse request body
    const requestData = await req.json();
    const { fileId, filePath } = requestData;
    console.log("Processing request for:", { fileId, filePath });

    if (!fileId || !filePath) {
      throw new Error('Missing required parameters: fileId and filePath are required');
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    // Update status to processing
    console.log("Updating status to processing");
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/file_conversions?id=eq.${fileId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status: 'processing'
        }),
      }
    );

    if (!updateResponse.ok) {
      console.error("Failed to update status:", updateResponse.status, updateResponse.statusText);
      throw new Error(`Failed to update status to processing: ${updateResponse.statusText}`);
    }

    // Download the PPTX file
    console.log("Downloading PPTX file");
    const fileResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/public/pptx_files/${filePath}`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
      }
    );

    if (!fileResponse.ok) {
      console.error("File download failed:", fileResponse.status, fileResponse.statusText);
      throw new Error(`Failed to download PPTX file: ${fileResponse.statusText}`);
    }

    const fileBlob = await fileResponse.blob();
    console.log("File downloaded successfully, size:", fileBlob.size);

    // Process the file content
    console.log("Processing file content");
    const processedContent = await processSlideContent(fileBlob);

    // Generate file paths
    const jsonPath = filePath.replace('.pptx', '.json');
    const markdownPath = filePath.replace('.pptx', '.md');

    // Upload JSON file
    console.log("Uploading JSON file");
    const jsonBlob = new Blob([JSON.stringify(processedContent, null, 2)], { 
      type: 'application/json' 
    });
    
    const jsonUploadResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/pptx_files/${jsonPath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
        body: jsonBlob,
      }
    );

    if (!jsonUploadResponse.ok) {
      throw new Error(`Failed to upload JSON file: ${jsonUploadResponse.statusText}`);
    }

    // Generate and upload markdown
    console.log("Generating and uploading markdown");
    const markdownContent = processedContent.slides
      .map(slide => `## Slide ${slide.index}\n\n${slide.content.join('\n\n')}\n\n`)
      .join('\n');

    const markdownBlob = new Blob([markdownContent], { type: 'text/markdown' });
    
    const markdownUploadResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/pptx_files/${markdownPath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
        body: markdownBlob,
      }
    );

    if (!markdownUploadResponse.ok) {
      throw new Error(`Failed to upload Markdown file: ${markdownUploadResponse.statusText}`);
    }

    // Update file status to completed
    console.log("Updating file status to completed");
    const finalUpdateResponse = await fetch(
      `${supabaseUrl}/rest/v1/file_conversions?id=eq.${fileId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status: 'completed',
          json_path: jsonPath,
          markdown_path: markdownPath,
        }),
      }
    );

    if (!finalUpdateResponse.ok) {
      throw new Error(`Failed to update file status: ${finalUpdateResponse.statusText}`);
    }

    console.log("Processing completed successfully");
    return new Response(
      JSON.stringify({ success: true }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Processing error:', error);
    
    try {
      const { fileId } = await req.json();
      if (fileId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (supabaseUrl && supabaseKey) {
          await fetch(
            `${supabaseUrl}/rest/v1/file_conversions?id=eq.${fileId}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${supabaseKey}`,
                apikey: supabaseKey,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
              body: JSON.stringify({
                status: 'error',
                error_message: error instanceof Error ? error.message : "Unknown error occurred",
              }),
            }
          );
        }
      }
    } catch (updateError) {
      console.error('Error updating file status:', updateError);
    }

    return new Response(
      JSON.stringify({
        error: 'Processing failed',
        details: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
});