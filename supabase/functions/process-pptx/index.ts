import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId, filePath } = await req.json();
    console.log('Starting processing for file:', fileId);
    console.log('File path:', filePath);

    if (!fileId || !filePath) {
      throw new Error('Missing required parameters: fileId and filePath are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Download the file
    console.log('Downloading file from storage...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pptx_files')
      .download(filePath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    if (!fileData) {
      throw new Error('No file data received');
    }

    console.log('File downloaded successfully, processing content...');
    
    // Process the PPTX content
    const arrayBuffer = await fileData.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    const structuredContent = {
      metadata: {
        processedAt: new Date().toISOString(),
        filename: filePath.split('/').pop(),
        slideCount: 0
      },
      slides: []
    };

    // Get presentation.xml for metadata
    const presentationXml = await zip.file("ppt/presentation.xml")?.async("string");
    if (presentationXml) {
      const parser = new DOMParser();
      const presentationDoc = parser.parseFromString(presentationXml, "text/xml");
      structuredContent.metadata.slideCount = presentationDoc.getElementsByTagName("p:sld").length;
    }

    // Process each slide
    const slidePromises = [];
    zip.folder("ppt/slides/")?.forEach((relativePath, zipEntry) => {
      if (relativePath.startsWith("slide") && relativePath.endsWith(".xml")) {
        const slidePromise = processSlide(zip, zipEntry);
        slidePromises.push(slidePromise);
      }
    });

    structuredContent.slides = await Promise.all(slidePromises);
    structuredContent.slides.sort((a, b) => a.index - b.index);

    // Generate file paths
    const jsonPath = filePath.replace('.pptx', '.json');
    const markdownPath = filePath.replace('.pptx', '.md');

    // Create markdown content
    console.log('Creating markdown content');
    const markdown = convertToMarkdown(structuredContent);

    console.log('Uploading processed files');
    const [jsonUpload, markdownUpload] = await Promise.all([
      supabase.storage
        .from('pptx_files')
        .upload(jsonPath, JSON.stringify(structuredContent, null, 2), {
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

    console.log('Updating file status to completed');
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
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Processing error:', error);
    
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
            error_message: error instanceof Error ? error.message : "Unknown error occurred"
          })
          .eq('id', fileId);
      }
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    return new Response(
      JSON.stringify({
        error: 'Processing failed',
        details: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

async function processSlide(zip: JSZip, zipEntry: JSZip.JSZipObject) {
  const slideContent = await zipEntry.async("string");
  const parser = new DOMParser();
  const slideDoc = parser.parseFromString(slideContent, "text/xml");
  
  // Extract slide number from filename
  const slideIndex = parseInt(zipEntry.name.match(/slide(\d+)\.xml/)?.[1] || "0");
  
  const slide = {
    index: slideIndex,
    title: "",
    content: [] as string[],
    shapes: [] as Array<{ type: string; text: string }>,
    notes: [] as string[]
  };

  // Extract text content
  const textElements = slideDoc.getElementsByTagName("a:t");
  for (const textElement of textElements) {
    const text = textElement.textContent?.trim();
    if (text) {
      if (!slide.title) {
        slide.title = text;
      } else {
        slide.content.push(text);
      }
    }
  }

  // Get slide notes if they exist
  const notesPath = `ppt/notesSlides/notesSlide${slideIndex}.xml`;
  const notesFile = zip.file(notesPath);
  if (notesFile) {
    const notesContent = await notesFile.async("string");
    const notesDoc = parser.parseFromString(notesContent, "text/xml");
    const noteElements = notesDoc.getElementsByTagName("a:t");
    for (const noteElement of noteElements) {
      const noteText = noteElement.textContent?.trim();
      if (noteText) {
        slide.notes.push(noteText);
      }
    }
  }

  return slide;
}

function convertToMarkdown(content: any): string {
  let markdown = `# ${content.metadata.filename}\n\n`;
  markdown += `## Presentation Overview\n`;
  markdown += `- Total Slides: ${content.metadata.slideCount}\n`;
  markdown += `- Processed At: ${content.metadata.processedAt}\n\n`;
  
  content.slides.forEach((slide: any) => {
    markdown += `## Slide ${slide.index}: ${slide.title || 'Untitled'}\n\n`;
    
    // Add content
    slide.content.forEach((text: string) => {
      if (text.trim()) {
        markdown += `${text}\n\n`;
      }
    });
    
    // Add notes if present
    if (slide.notes.length > 0) {
      markdown += '### Speaker Notes\n\n';
      slide.notes.forEach((note: string) => {
        markdown += `> ${note}\n\n`;
      });
    }
  });
  
  return markdown;
}