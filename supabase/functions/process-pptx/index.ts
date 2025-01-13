import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSuccessResponse, createErrorResponse, createCorsPreflightResponse } from "./utils/responseHandlers.ts";
import { downloadAndProcessFile, uploadProcessedFiles } from "./utils/fileProcessing.ts";
import { updateFileStatus } from "./utils/databaseOperations.ts";

serve(async (req) => {
  console.log("Received request:", req.method);
  
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return createCorsPreflightResponse();
  }

  try {
    const requestData = await req.json();
    const { fileId, filePath } = requestData;
    console.log("Processing request for:", { fileId, filePath });

    if (!fileId || !filePath) {
      throw new Error('Missing required parameters: fileId and filePath are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    // Update status to processing
    await updateFileStatus(supabaseUrl, supabaseKey, fileId, 'processing');

    // Process the file
    const processedContent = await downloadAndProcessFile(supabaseUrl, supabaseKey, filePath);

    // Upload processed files
    const { jsonPath, markdownPath } = await uploadProcessedFiles(
      supabaseUrl,
      supabaseKey,
      filePath,
      processedContent
    );

    // Update status to completed
    await updateFileStatus(supabaseUrl, supabaseKey, fileId, 'completed', { jsonPath, markdownPath });

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

    return createErrorResponse(
      error instanceof Error ? error : new Error("Unknown error occurred")
    );
  }
});