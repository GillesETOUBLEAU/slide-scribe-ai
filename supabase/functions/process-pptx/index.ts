import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "./utils.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received request:", req.method, req.url);
    
    // Parse request body
    let payload;
    try {
      payload = await req.json();
      console.log("Request payload:", payload);
    } catch (e) {
      console.error("Error parsing request JSON:", e);
      throw new Error("Invalid JSON payload");
    }

    const { fileId, filePath } = payload;
    if (!fileId || !filePath) {
      throw new Error("Missing required parameters: fileId and filePath");
    }

    // Validate environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing required environment variables");
    }

    // Update status to processing
    console.log("Updating status to processing for file:", fileId);
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/file_conversions?id=eq.${fileId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          status: "processing",
        }),
      }
    );

    if (!updateResponse.ok) {
      throw new Error(`Failed to update status: ${updateResponse.statusText}`);
    }

    // Download the file
    console.log("Downloading file:", filePath);
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
      throw new Error(`Failed to download file: ${fileResponse.statusText}`);
    }

    // Process the file
    const fileData = await fileResponse.arrayBuffer();
    console.log("File downloaded, size:", fileData.byteLength);

    // Return success response
    return new Response(
      JSON.stringify({ success: true, message: "Processing started" }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error processing request:", error);
    
    // Try to update file status to error if we have fileId
    try {
      const { fileId } = await req.json();
      if (fileId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        
        if (supabaseUrl && supabaseKey) {
          await fetch(
            `${supabaseUrl}/rest/v1/file_conversions?id=eq.${fileId}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${supabaseKey}`,
                apikey: supabaseKey,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({
                status: "error",
                error_message: error instanceof Error ? error.message : "Unknown error occurred",
              }),
            }
          );
        }
      }
    } catch (updateError) {
      console.error("Error updating file status:", updateError);
    }

    return new Response(
      JSON.stringify({
        error: "Processing failed",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});