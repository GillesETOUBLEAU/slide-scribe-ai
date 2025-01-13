import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "./utils.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId } = await req.json();
    console.log('Processing file:', fileId);

    if (!fileId) {
      throw new Error('No fileId provided');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update status to error if memory limit is exceeded
    const updateStatus = async (status: string, error?: string) => {
      const { error: updateError } = await supabase
        .from('file_conversions')
        .update({ 
          status,
          error_message: error
        })
        .eq('id', fileId);

      if (updateError) {
        console.error('Error updating status:', updateError);
      }
    };

    // Get file data
    const { data: fileData, error: fileError } = await supabase
      .from('file_conversions')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError) {
      throw fileError;
    }

    // Download file
    const { data: fileContent, error: downloadError } = await supabase.storage
      .from('pptx_files')
      .download(fileData.pptx_path);

    if (downloadError) {
      throw downloadError;
    }

    // Check file size
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (fileContent.size > MAX_FILE_SIZE) {
      await updateStatus('error', 'File too large. Maximum size is 5MB.');
      return new Response(
        JSON.stringify({ error: 'File too large' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 413 }
      );
    }

    // For now, we'll return a success response but mark the file as unsupported
    await updateStatus('error', 'PPTX processing is currently unavailable due to resource constraints. Please try with a smaller file.');

    return new Response(
      JSON.stringify({ 
        message: 'File size checked',
        status: 'error',
        details: 'PPTX processing is currently unavailable due to resource constraints'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Processing error:', error);
    
    // Try to update the status to error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { fileId } = await req.json();
      if (fileId) {
        await supabase
          .from('file_conversions')
          .update({ 
            status: 'error',
            error_message: error.message
          })
          .eq('id', fileId);
      }
    } catch (updateError) {
      console.error('Error updating status:', updateError);
    }

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