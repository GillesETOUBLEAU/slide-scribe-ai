import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function processFile(fileId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get file data
    const { data: fileData, error: fileError } = await supabase
      .from('file_conversions')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError) throw fileError;
    if (!fileData) throw new Error('File not found');

    // Download the file
    const { data: fileContent, error: downloadError } = await supabase
      .storage
      .from('pptx_files')
      .download(fileData.pptx_path);

    if (downloadError) throw downloadError;

    // Process the file content
    const processedContent = {
      metadata: {
        processedAt: new Date().toISOString(),
        filename: fileData.original_filename
      },
      content: await extractContent(fileContent)
    };

    // Generate file paths
    const jsonPath = fileData.pptx_path.replace('.pptx', '.json');
    const markdownPath = fileData.pptx_path.replace('.pptx', '.md');

    // Upload processed files
    const jsonBlob = new Blob([JSON.stringify(processedContent)], { type: 'application/json' });
    const markdownContent = generateMarkdown(processedContent);
    const markdownBlob = new Blob([markdownContent], { type: 'text/markdown' });

    await Promise.all([
      supabase.storage
        .from('pptx_files')
        .upload(jsonPath, jsonBlob, { upsert: true }),
      supabase.storage
        .from('pptx_files')
        .upload(markdownPath, markdownBlob, { upsert: true })
    ]);

    // Update file status
    await supabase
      .from('file_conversions')
      .update({
        status: 'completed',
        json_path: jsonPath,
        markdown_path: markdownPath
      })
      .eq('id', fileId);

    return { success: true, jsonPath, markdownPath };
  } catch (error) {
    console.error('Error processing file:', error);

    // Update status to error
    await supabase
      .from('file_conversions')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : "Unknown error occurred"
      })
      .eq('id', fileId);

    throw error;
  }
}

async function extractContent(file: Blob): Promise<string[]> {
  // For now, return a simple placeholder content
  // This can be expanded later with actual PPTX parsing logic
  return ['Slide content placeholder'];
}

function generateMarkdown(content: any): string {
  let markdown = `# ${content.metadata.filename}\n\n`;
  markdown += `Processed at: ${content.metadata.processedAt}\n\n`;
  
  content.content.forEach((text: string) => {
    markdown += `${text}\n\n`;
  });

  return markdown;
}