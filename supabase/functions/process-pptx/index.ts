import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { fileId } = await req.json()
    console.log('Processing file:', fileId)

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

    if (fileError) {
      console.error('Error fetching file data:', fileError)
      throw fileError
    }

    // Download PPTX file
    const { data: fileContent, error: downloadError } = await supabase
      .storage
      .from('pptx_files')
      .download(fileData.pptx_path)

    if (downloadError) {
      console.error('Error downloading file:', downloadError)
      throw downloadError
    }

    // Process PPTX content
    const result = await extractPPTXContent(fileContent)
    console.log('File processed successfully')

    // Upload JSON and Markdown files
    const jsonPath = fileData.pptx_path.replace('.pptx', '.json')
    const markdownPath = fileData.pptx_path.replace('.pptx', '.md')

    const jsonBlob = new Blob([JSON.stringify(result.json, null, 2)], { type: 'application/json' })
    const markdownBlob = new Blob([result.markdown], { type: 'text/markdown' })

    const { error: jsonUploadError } = await supabase
      .storage
      .from('pptx_files')
      .upload(jsonPath, jsonBlob)

    if (jsonUploadError) {
      console.error('Error uploading JSON:', jsonUploadError)
      throw jsonUploadError
    }

    const { error: markdownUploadError } = await supabase
      .storage
      .from('pptx_files')
      .upload(markdownPath, markdownBlob)

    if (markdownUploadError) {
      console.error('Error uploading Markdown:', markdownUploadError)
      throw markdownUploadError
    }

    // Update file conversion record
    const { error: updateError } = await supabase
      .from('file_conversions')
      .update({
        json_path: jsonPath,
        markdown_path: markdownPath,
        status: 'completed'
      })
      .eq('id', fileId)

    if (updateError) {
      console.error('Error updating file record:', updateError)
      throw updateError
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 500 
      }
    )
  }
})

async function extractPPTXContent(file) {
  try {
    const workbook = XLSX.read(file, { 
      type: 'array',
      cellStyles: true,
      cellFormulas: true,
      cellDates: true,
      cellNF: true,
      sheetStubs: true
    });

    const structuredContent = {
      metadata: {
        lastModified: new Date().toISOString(),
      },
      slides: []
    };

    // Process each sheet (slide)
    workbook.SheetNames.forEach((sheetName, index) => {
      const sheet = workbook.Sheets[sheetName];
      const slideContent = {
        index: index + 1,
        title: extractSlideTitle(sheet),
        content: [],
        notes: extractNotes(sheet),
        shapes: extractShapes(sheet)
      };

      // Extract text content
      const textContent = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        .flat()
        .filter(cell => cell && typeof cell === 'string');

      slideContent.content = textContent;
      structuredContent.slides.push(slideContent);
    });

    return {
      json: structuredContent,
      markdown: convertToMarkdown(structuredContent)
    };
  } catch (error) {
    console.error('Error processing PPTX:', error);
    throw error;
  }
}

function extractSlideTitle(sheet) {
  // Attempt to find title in common locations
  const titleCells = ['A1', 'B1', 'C1'];
  for (const cell of titleCells) {
    if (sheet[cell] && sheet[cell].v) {
      return sheet[cell].v.toString();
    }
  }
  return 'Untitled Slide';
}

function extractNotes(sheet) {
  // Look for notes in the sheet's comments or specific cells
  const notes = [];
  if (sheet['!comments']) {
    Object.values(sheet['!comments']).forEach(comment => {
      if (comment.t) notes.push(comment.t);
    });
  }
  return notes;
}

function extractShapes(sheet) {
  // Extract shape data if available
  const shapes = [];
  if (sheet['!drawings']) {
    sheet['!drawings'].forEach(drawing => {
      if (drawing.shape) {
        shapes.push({
          type: drawing.shape.type,
          text: drawing.shape.text || ''
        });
      }
    });
  }
  return shapes;
}

function convertToMarkdown(structuredContent) {
  let markdown = `# ${structuredContent.metadata.lastModified}\n\n`;

  structuredContent.slides.forEach(slide => {
    markdown += `## Slide ${slide.index}: ${slide.title}\n\n`;

    // Add content
    slide.content.forEach(text => {
      if (text.trim()) {
        markdown += `${text}\n\n`;
      }
    });

    // Add notes if present
    if (slide.notes.length > 0) {
      markdown += '### Notes\n\n';
      slide.notes.forEach(note => {
        markdown += `> ${note}\n\n`;
      });
    }

    // Add shapes if present
    if (slide.shapes.length > 0) {
      markdown += '### Shapes\n\n';
      slide.shapes.forEach(shape => {
        markdown += `- ${shape.type}: ${shape.text}\n`;
      });
      markdown += '\n';
    }
  });

  return markdown;
}