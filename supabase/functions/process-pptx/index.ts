import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  corsHeaders,
  createSupabaseClient,
  getFileData,
  downloadPPTX,
  extractPPTXContent,
  uploadProcessedFiles,
  updateFileStatus,
} from "./utils.ts"

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

    const supabase = createSupabaseClient();
    console.log('Supabase client created');
    
    // Get file data
    console.log('Fetching file data from database');
    const fileData = await getFileData(supabase, fileId);
    console.log('File data retrieved:', fileData);
    
    // Download PPTX
    console.log('Downloading PPTX file');
    const fileContent = await downloadPPTX(supabase, fileData.pptx_path);
    console.log('PPTX file downloaded successfully');
    
    // Process content
    console.log('Extracting PPTX content');
    const result = await extractPPTXContent(fileContent);
    console.log('Content extracted successfully');
    
    // Generate paths
    const jsonPath = fileData.pptx_path.replace('.pptx', '.json');
    const markdownPath = fileData.pptx_path.replace('.pptx', '.md');
    
    // Upload processed files
    console.log('Uploading processed files');
    await uploadProcessedFiles(
      supabase,
      jsonPath,
      markdownPath,
      result.json,
      result.markdown
    );
    console.log('Processed files uploaded successfully');
    
    // Update status
    console.log('Updating file status');
    await updateFileStatus(supabase, fileId, jsonPath, markdownPath);
    console.log('File status updated successfully');

    console.log('Processing completed successfully');
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Processing error:', error);
    
    // Try to update the file status with error
    try {
      const supabase = createSupabaseClient();
      await supabase
        .from('file_conversions')
        .update({
          status: 'error',
          error_message: error.message
        })
        .eq('id', req.fileId);
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});