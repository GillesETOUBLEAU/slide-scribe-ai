import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from "./utils.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId, fileUrl } = await req.json();
    console.log('Processing file:', fileId, 'from URL:', fileUrl);

    if (!fileId || !fileUrl) {
      throw new Error('Missing required parameters');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get file data
    const { data: fileData, error: fileError } = await supabase
      .from('file_conversions')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError) {
      throw fileError;
    }

    // For now, we'll return a success response but mark the file as unsupported
    await supabase
      .from('file_conversions')
      .update({ 
        status: 'error',
        error_message: 'PPTX processing is currently unavailable. Please try with a smaller file.'
      })
      .eq('id', fileId);

    return new Response(
      JSON.stringify({ 
        message: 'File received',
        status: 'error',
        details: 'PPTX processing is currently unavailable'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Processing error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Processing failed',
        details: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});