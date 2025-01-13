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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { fileId } = await req.json()
    console.log('Starting processing for file:', fileId)

    const supabase = createSupabaseClient()
    
    // Get file data and process it
    const fileData = await getFileData(supabase, fileId)
    const fileContent = await downloadPPTX(supabase, fileData.pptx_path)
    const result = await extractPPTXContent(fileContent)
    
    // Generate file paths
    const jsonPath = fileData.pptx_path.replace('.pptx', '.json')
    const markdownPath = fileData.pptx_path.replace('.pptx', '.md')
    
    // Upload processed files
    await uploadProcessedFiles(
      supabase,
      jsonPath,
      markdownPath,
      result.json,
      result.markdown
    )
    
    // Update file status
    await updateFileStatus(supabase, fileId, jsonPath, markdownPath)

    console.log('Processing completed successfully')
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Processing error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})