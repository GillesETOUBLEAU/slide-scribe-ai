import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { parse } from 'https://esm.sh/pptx-parser@1.0.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function extractPPTXContent(arrayBuffer: ArrayBuffer, filename: string) {
  try {
    const presentation = await parse(arrayBuffer);
    
    const structuredContent = {
      metadata: {
        filename: filename,
        processedAt: new Date().toISOString(),
        slideCount: presentation.slides.length
      },
      slides: presentation.slides.map((slide, index) => ({
        index: index + 1,
        title: extractSlideTitle(slide),
        content: extractSlideContent(slide),
        notes: slide.notes || [],
        shapes: extractShapes(slide)
      }))
    };

    return {
      json: structuredContent,
      markdown: convertToMarkdown(structuredContent)
    };
  } catch (error) {
    console.error('Error processing PPTX:', error);
    throw error;
  }
}

function extractSlideTitle(slide: any) {
  // Look for title in slide properties
  if (slide.title) return slide.title;
  
  // Look for first text shape that might be a title
  const titleShape = slide.shapes?.find(shape => 
    shape.type === 'title' || 
    (shape.type === 'text' && shape.properties?.isTitle)
  );
  
  return titleShape?.text || 'Untitled Slide';
}

function extractSlideContent(slide: any) {
  const content: string[] = [];
  
  // Extract text from all shapes
  if (slide.shapes) {
    slide.shapes.forEach((shape: any) => {
      if (shape.text) {
        content.push(shape.text);
      }
    });
  }
  
  return content;
}

function extractShapes(slide: any) {
  return slide.shapes?.map((shape: any) => ({
    type: shape.type || 'unknown',
    text: shape.text || ''
  })) || [];
}

function convertToMarkdown(structuredContent: any): string {
  let markdown = `# ${structuredContent.metadata.filename}\n\n`;
  markdown += `Processed at: ${structuredContent.metadata.processedAt}\n`;
  markdown += `Total Slides: ${structuredContent.metadata.slideCount}\n\n`;

  structuredContent.slides.forEach((slide: any) => {
    markdown += `## Slide ${slide.index}: ${slide.title}\n\n`;

    // Add content
    slide.content.forEach((text: string) => {
      if (text.trim()) {
        markdown += `${text}\n\n`;
      }
    });

    // Add notes if present
    if (slide.notes.length > 0) {
      markdown += '### Notes\n\n';
      slide.notes.forEach((note: string) => {
        markdown += `> ${note}\n\n`;
      });
    }

    // Add shapes if present
    if (slide.shapes.length > 0) {
      markdown += '### Shapes\n\n';
      slide.shapes.forEach((shape: any) => {
        markdown += `- ${shape.type}: ${shape.text}\n`;
      });
      markdown += '\n';
    }
  });

  return markdown;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId } = await req.json();
    console.log('Processing file:', fileId);

    if (!fileId) {
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

    if (fileError) throw fileError;
    console.log('File data retrieved:', fileData);

    // Download the PPTX file
    const { data: fileContent, error: downloadError } = await supabase.storage
      .from('pptx_files')
      .download(fileData.pptx_path);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    if (!fileContent) {
      throw new Error('No file content received');
    }

    console.log('File downloaded successfully, size:', fileContent.size);

    // Process the PPTX content
    const arrayBuffer = await fileContent.arrayBuffer();
    const { json, markdown } = await extractPPTXContent(arrayBuffer, fileData.original_filename);

    // Generate paths for processed files
    const jsonPath = fileData.pptx_path.replace('.pptx', '.json');
    const markdownPath = fileData.pptx_path.replace('.pptx', '.md');

    console.log('Uploading processed files');

    // Upload processed files
    const [jsonUpload, markdownUpload] = await Promise.all([
      supabase.storage
        .from('pptx_files')
        .upload(jsonPath, JSON.stringify(json), {
          contentType: 'application/json',
          upsert: true
        }),
      supabase.storage
        .from('pptx_files')
        .upload(markdownPath, markdown, {
          contentType: 'text/markdown',
          upsert: true
        })
    ]);

    if (jsonUpload.error) throw jsonUpload.error;
    if (markdownUpload.error) throw markdownUpload.error;

    console.log('Files uploaded successfully');

    // Update file status to completed
    const { error: updateError } = await supabase
      .from('file_conversions')
      .update({
        status: 'completed',
        json_path: jsonPath,
        markdown_path: markdownPath
      })
      .eq('id', fileId);

    if (updateError) throw updateError;

    console.log('Processing completed successfully');

    return new Response(
      JSON.stringify({ status: 'success' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Processing error:', error);

    // Update file status to error if we have the fileId
    try {
      const { fileId } = await req.json();
      if (fileId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabase
          .from('file_conversions')
          .update({
            status: 'error',
            error_message: error.message
          })
          .eq('id', fileId);
      }
    } catch (e) {
      console.error('Failed to update error status:', e);
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