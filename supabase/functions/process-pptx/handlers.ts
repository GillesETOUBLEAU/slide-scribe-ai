import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { ProcessingError } from "./errors.ts";
import { processSlideContent } from "./slideProcessor.ts";
import { generateMarkdown } from "./markdown.ts";
import type { FileData } from "./types.ts";

export async function handleFileProcessing(fileId: string, filePath: string) {
  console.log('Starting processing for file:', fileId);
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Download the file
    console.log('Downloading file from storage...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pptx_files')
      .download(filePath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new ProcessingError(`Failed to download file: ${downloadError.message}`);
    }

    if (!fileData) {
      throw new ProcessingError('No file data received');
    }

    const processedContent = await processSlideContent(fileData);
    await uploadProcessedFiles(supabase, fileId, filePath, processedContent);

    return { success: true };
  } catch (error) {
    await updateErrorStatus(supabase, fileId, error);
    throw error;
  }
}

async function uploadProcessedFiles(
  supabase: any, 
  fileId: string, 
  filePath: string, 
  content: FileData
) {
  const jsonPath = filePath.replace('.pptx', '.json');
  const markdownPath = filePath.replace('.pptx', '.md');
  const markdown = generateMarkdown(content);

  const [jsonUpload, markdownUpload] = await Promise.all([
    supabase.storage
      .from('pptx_files')
      .upload(jsonPath, JSON.stringify(content, null, 2), {
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

  const { error: updateError } = await supabase
    .from('file_conversions')
    .update({
      status: 'completed',
      json_path: jsonPath,
      markdown_path: markdownPath
    })
    .eq('id', fileId);

  if (updateError) throw updateError;
}

async function updateErrorStatus(supabase: any, fileId: string, error: Error) {
  try {
    await supabase
      .from('file_conversions')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : "Unknown error occurred"
      })
      .eq('id', fileId);
  } catch (updateError) {
    console.error('Failed to update error status:', updateError);
  }
}