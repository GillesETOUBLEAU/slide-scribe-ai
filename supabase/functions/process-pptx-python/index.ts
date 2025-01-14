import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the request body
    const body = await req.json();
    const { fileId, filePath } = body;

    if (!fileId || !filePath) {
      throw new Error("Missing required parameters: fileId or filePath");
    }

    // Create command to run Python script
    const command = new Deno.Command("python3", {
      args: ["processor.py", fileId, filePath],
    });

    // Run the command
    const { success, stdout, stderr } = await command.output();

    if (!success) {
      console.error("Python script error:", new TextDecoder().decode(stderr));
      throw new Error("Failed to process PPTX file");
    }

    const result = new TextDecoder().decode(stdout);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Error:", error.message);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "An error occurred while processing the file" 
      }),
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});