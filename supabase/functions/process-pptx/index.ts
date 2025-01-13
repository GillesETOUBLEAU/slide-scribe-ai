import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { processSlideContent } from "./slideProcessor.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders,
      status: 200
    });
  }

  try {
    const { fileId, filePath } = await req.json();
    console.log("Processing file:", { fileId, filePath });

    if (!fileId || !filePath) {
      throw new Error('Missing required parameters: fileId and filePath are required');
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    // Download the PPTX file
    console.log("Downloading PPTX file from storage");
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
      throw new Error(`Failed to download PPTX file: ${fileResponse.statusText}`);
    }

    const fileBlob = await fileResponse.blob();
    
    // Process the PPTX content
    console.log("Processing PPTX content");
    const processedContent = await processSlideContent(fileBlob);
    processedContent.metadata.filePath = filePath;

    // Generate file paths
    const jsonPath = filePath.replace('.pptx', '.json');
    const markdownPath = filePath.replace('.pptx', '.md');

    // Upload JSON file
    console.log("Uploading JSON file to:", jsonPath);
    const jsonBlob = new Blob([JSON.stringify(processedContent, null, 2)], { 
      type: 'application/json' 
    });
    
    const jsonUploadResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/public/pptx_files/${jsonPath}`,
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
    console.log("Generating markdown content");
    const markdownContent = `# ${processedContent.metadata.filename}\n\n` +
      `Processed at: ${processedContent.metadata.processedAt}\n\n` +
      processedContent.slides.map(slide => 
        `## Slide ${slide.index}: ${slide.title}\n\n` +
        `${slide.content.join('\n\n')}\n\n` +
        (slide.notes.length > 0 ? `### Notes\n\n${slide.notes.join('\n\n')}\n\n` : '') +
        (slide.shapes.length > 0 ? `### Shapes\n\n${slide.shapes.map(shape => 
          `- ${shape.type}: ${shape.text}`).join('\n')}\n\n` : '')
      ).join('\n');

    console.log("Uploading Markdown file to:", markdownPath);
    const markdownBlob = new Blob([markdownContent], { type: 'text/markdown' });
    
    const markdownUploadResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/public/pptx_files/${markdownPath}`,
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

    // Update file status in database
    console.log("Updating file status in database");
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
          status: 'completed',
          json_path: jsonPath,
          markdown_path: markdownPath,
        }),
      }
    );

    if (!updateResponse.ok) {
      throw new Error(`Failed to update file status: ${updateResponse.statusText}`);
    }

    console.log("Processing completed successfully");

    return new Response(
      JSON.stringify({ success: true, jsonPath, markdownPath }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 200
      }
    );
  } catch (error) {
    console.error('Processing error:', error);

    // If we have a fileId, update the status to error
    try {
      if (req.json && (await req.json()).fileId) {
        const { fileId } = await req.json();
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
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 500
      }
    );
  }
});