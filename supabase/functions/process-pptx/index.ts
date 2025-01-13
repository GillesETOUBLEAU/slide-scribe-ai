import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "./utils.ts"
import { processFile } from "./process.ts"

serve(async (req) => {
  console.log("Edge function started");
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId } = await req.json();
    console.log('Processing file:', fileId);

    if (!fileId) {
      console.error('No fileId provided');
      throw new Error('No fileId provided');
    }

    const result = await processFile(fileId);
    
    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Processing error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});