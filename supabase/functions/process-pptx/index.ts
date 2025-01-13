import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { fileId } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get file conversion record
    const { data: fileData, error: fileError } = await supabase
      .from('file_conversions')
      .select('*')
      .eq('id', fileId)
      .single()

    if (fileError) throw fileError

    // Download PPTX file
    const { data: fileContent, error: downloadError } = await supabase
      .storage
      .from('pptx_files')
      .download(fileData.pptx_path)

    if (downloadError) throw downloadError

    // Process PPTX content
    const result = await extractPPTXContent(fileContent)

    // Upload JSON and Markdown files
    const jsonPath = fileData.pptx_path.replace('.pptx', '.json')
    const markdownPath = fileData.pptx_path.replace('.pptx', '.md')

    const jsonBlob = new Blob([JSON.stringify(result.json, null, 2)], { type: 'application/json' })
    const markdownBlob = new Blob([result.markdown], { type: 'text/markdown' })

    const { error: jsonUploadError } = await supabase
      .storage
      .from('pptx_files')
      .upload(jsonPath, jsonBlob)

    if (jsonUploadError) throw jsonUploadError

    const { error: markdownUploadError } = await supabase
      .storage
      .from('pptx_files')
      .upload(markdownPath, markdownBlob)

    if (markdownUploadError) throw markdownUploadError

    // Update file conversion record
    const { error: updateError } = await supabase
      .from('file_conversions')
      .update({
        json_path: jsonPath,
        markdown_path: markdownPath,
        status: 'completed'
      })
      .eq('id', fileId)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

// Your existing PPTX processing functions
function extractPPTXContent(file) {
  const workbook = XLSX.read(file, { type: 'array' });
  const slides = workbook.SheetNames.map(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    return {
      title: extractSlideTitle(sheet),
      notes: extractNotes(sheet),
      shapes: extractShapes(sheet),
    };
  });
  return {
    json: slides,
    markdown: convertToMarkdown(slides),
  };
}

function extractSlideTitle(sheet) {
  const titleCell = sheet['A1']; // Assuming title is in A1
  return titleCell ? titleCell.v : '';
}

function extractNotes(sheet) {
  const notesCell = sheet['B1']; // Assuming notes are in B1
  return notesCell ? notesCell.v : '';
}

function extractShapes(sheet) {
  const shapes = [];
  for (const key in sheet) {
    if (key[0] === '!') continue; // Skip metadata
    shapes.push(sheet[key].v);
  }
  return shapes;
}

function convertToMarkdown(structuredContent) {
  return structuredContent.map(slide => `# ${slide.title}\n\n${slide.notes}\n\n`).join('\n');
}
