import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { JSZip } from "https://esm.sh/jszip@3.10.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function processPPTX(fileData: ArrayBuffer): Promise<any> {
  const zip = new JSZip();
  await zip.loadAsync(fileData);
  
  const slides: any[] = [];
  const slideFiles = Object.keys(zip.files).filter(name => 
    name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
  );
  
  for (const slideFile of slideFiles) {
    const slideXml = await zip.file(slideFile)?.async('text');
    if (!slideXml) continue;

    // Extract slide number from filename (e.g., "slide1.xml" -> 1)
    const slideNumber = parseInt(slideFile.match(/slide(\d+)\.xml/)?.[1] || '0');
    
    // Basic XML parsing to extract text content
    const textContent = slideXml
      .match(/<a:t>([^<]*)<\/a:t>/g)
      ?.map(match => match.replace(/<[^>]+>/g, '').trim())
      .filter(text => text.length > 0) || [];

    // Get notes if they exist
    const notesFile = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
    let notes: string[] = [];
    const notesXml = await zip.file(notesFile)?.async('text');
    if (notesXml) {
      notes = notesXml
        .match(/<a:t>([^<]*)<\/a:t>/g)
        ?.map(match => match.replace(/<[^>]+>/g, '').trim())
        .filter(text => text.length > 0) || [];
    }

    slides.push({
      index: slideNumber,
      title: textContent[0] || `Slide ${slideNumber}`,
      content: textContent.slice(1),
      notes,
      shapes: []
    });
  }

  return {
    metadata: {
      processedAt: new Date().toISOString(),
      slideCount: slides.length
    },
    slides: slides.sort((a, b) => a.index - b.index)
  };
}

function generateMarkdown(data: any): string {
  let markdown = `# ${data.metadata.filename}\n\n`;
  markdown += `Processed at: ${data.metadata.processedAt}\n`;
  markdown += `Total Slides: ${data.metadata.slideCount}\n\n`;
  
  for (const slide of data.slides) {
    markdown += `## ${slide.title}\n\n`;
    
    if (slide.content.length) {
      markdown += "### Content\n\n";
      for (const content of slide.content) {
        markdown += `- ${content}\n`;
      }
      markdown += "\n";
    }
    
    if (slide.notes.length) {
      markdown += "### Notes\n\n";
      for (const note of slide.notes) {
        markdown += `> ${note}\n`;
      }
      markdown += "\n";
    }
  }
  
  return markdown;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId, filePath } = await req.json();
    console.log(`Processing file: ${fileId} at path: ${filePath}`);

    if (!fileId || !filePath) {
      throw new Error("Missing required parameters: fileId or filePath");
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("pptx_files")
      .download(filePath);

    if (downloadError) {
      console.error("Download error:", downloadError);
      throw downloadError;
    }

    // Process the PPTX file
    const result = await processPPTX(await fileData.arrayBuffer());
    result.metadata.filename = filePath.split('/').pop() || 'unknown.pptx';

    // Generate output paths
    const jsonPath = filePath.replace(".pptx", ".json");
    const markdownPath = filePath.replace(".pptx", ".md");

    // Upload JSON result
    const { error: jsonError } = await supabase.storage
      .from("pptx_files")
      .upload(jsonPath, JSON.stringify(result), {
        contentType: "application/json",
        upsert: true
      });

    if (jsonError) {
      console.error("JSON upload error:", jsonError);
      throw jsonError;
    }

    // Generate and upload markdown
    const markdownContent = generateMarkdown(result);
    const { error: mdError } = await supabase.storage
      .from("pptx_files")
      .upload(markdownPath, markdownContent, {
        contentType: "text/markdown",
        upsert: true
      });

    if (mdError) {
      console.error("Markdown upload error:", mdError);
      throw mdError;
    }

    // Update database record
    const { error: dbError } = await supabase
      .from("file_conversions")
      .update({
        status: "completed",
        json_path: jsonPath,
        markdown_path: markdownPath
      })
      .eq("id", fileId);

    if (dbError) {
      console.error("Database update error:", dbError);
      throw dbError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {
    console.error("Processing error:", error);
    
    // Update database record with error status
    if (error instanceof Error) {
      const { fileId } = await req.json();
      if (fileId) {
        await supabase
          .from("file_conversions")
          .update({
            status: "error",
            error_message: error.message
          })
          .eq("id", fileId);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "An error occurred while processing the file" 
      }),
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
});