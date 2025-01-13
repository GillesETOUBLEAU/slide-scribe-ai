import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleFileProcessing } from "./handlers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders,
      status: 204 
    });
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
      const body = await req.json();
      console.log("Request body:", body);
      
      // Validate required fields
      if (!body.fileId || !body.filePath) {
        throw new Error("Missing required fields: fileId and filePath");
      }
      
      payload = {
        fileId: body.fileId,
        filePath: body.filePath
      };
      
      console.log("Validated payload:", payload);
    } catch (e) {
      console.error("Error parsing/validating request body:", e);
      throw new Error(`Invalid or malformed JSON payload: ${e.message}`);
    }

    // Process the file
    const result = await handleFileProcessing(payload.fileId, payload.filePath);

    // Return success response with CORS headers
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