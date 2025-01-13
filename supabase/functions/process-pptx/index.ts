import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSuccessResponse, createErrorResponse, createCorsPreflightResponse } from "./utils/responseHandlers.ts";
import { downloadAndProcessFile, uploadProcessedFiles } from "./utils/fileProcessing.ts";
import { updateFileStatus } from "./utils/databaseOperations.ts";

serve(async (req) => {
  // Add detailed logging
  console.log("Request received:", {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });
  
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return createCorsPreflightResponse();
  }

  try {
    const requestData = await req.json();
    console.log("Request data:", requestData);
    
    const { fileId, filePath } = requestData;
    if (!fileId || !filePath) {
      throw new Error('Missing required parameters: fileId and filePath are required');
    }

    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    console.log("Starting processing for file:", fileId);
    await updateFileStatus(supabaseUrl, supabaseKey, fileId, 'processing');

    const processedContent = await downloadAndProcessFile(supabaseUrl, supabaseKey, filePath);
    console.log("File processed successfully");

    const { jsonPath, markdownPath } = await uploadProcessedFiles(
      supabaseUrl,
      supabaseKey,
      filePath,
      processedContent
    );
    console.log("Processed files uploaded successfully");

    await updateFileStatus(supabaseUrl, supabaseKey, fileId, 'completed', { jsonPath, markdownPath });
    console.log("Processing completed successfully");

    return createSuccessResponse({ success: true });

  } catch (error) {
    console.error('Processing error:', error);
    
    try {
      const { fileId } = await req.json();
      if (fileId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (supabaseUrl && supabaseKey) {
          await updateFileStatus(
            supabaseUrl,
            supabaseKey,
            fileId,
            'error',
            undefined,
            error instanceof Error ? error.message : "Unknown error occurred"
          );
        }
      }
    } catch (updateError) {
      console.error('Error updating file status:', updateError);
    }

    return createErrorResponse(error);
  }
});