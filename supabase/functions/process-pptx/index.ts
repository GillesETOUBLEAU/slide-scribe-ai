import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleFileProcessing } from "./handlers.ts";

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
    console.log("Received request:", req.method, req.url);
    
    // Validate request method
    if (req.method !== 'POST') {
      throw new Error(`Method ${req.method} not allowed`);
    }

    // Parse and validate request body
    let payload;
    try {
      const body = await req.text();
      console.log("Request body:", body);
      payload = JSON.parse(body);
    } catch (e) {
      console.error("Error parsing request body:", e);
      throw new Error("Invalid JSON payload");
    }

    // Validate required fields
    const { fileId, filePath } = payload;
    if (!fileId || !filePath) {
      throw new Error("Missing required fields: fileId and filePath");
    }

    console.log("Processing file:", { fileId, filePath });

    // Process the file
    const result = await handleFileProcessing(fileId, filePath);

    // Return success response
    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error processing request:", error);
    
    return new Response(
      JSON.stringify({
        error: "Processing failed",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      }
    );
  }
});