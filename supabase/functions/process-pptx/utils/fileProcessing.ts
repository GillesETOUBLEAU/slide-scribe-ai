import { processSlideContent } from "../slideProcessor.ts";

export async function downloadAndProcessFile(supabaseUrl: string, supabaseKey: string, filePath: string) {
  console.log("Downloading PPTX file");
  const fileResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/public/pptx_files/${filePath}`,
    {
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
      },
    }
  );

  if (!fileResponse.ok) {
    console.error("File download failed:", fileResponse.status, fileResponse.statusText);
    throw new Error(`Failed to download PPTX file: ${fileResponse.statusText}`);
  }

  const fileBlob = await fileResponse.blob();
  console.log("File downloaded successfully, size:", fileBlob.size);

  console.log("Processing file content");
  return processSlideContent(fileBlob);
}

export async function uploadProcessedFiles(
  supabaseUrl: string, 
  supabaseKey: string, 
  filePath: string, 
  processedContent: any
) {
  const jsonPath = filePath.replace('.pptx', '.json');
  const markdownPath = filePath.replace('.pptx', '.md');

  // Upload JSON file
  console.log("Uploading JSON file");
  const jsonBlob = new Blob([JSON.stringify(processedContent, null, 2)], { 
    type: 'application/json' 
  });
  
  const jsonUploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/pptx_files/${jsonPath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
      },
      body: jsonBlob,
    }
  );

  if (!jsonUploadResponse.ok) {
    throw new Error(`Failed to upload JSON file: ${jsonUploadResponse.statusText}`);
  }

  // Generate and upload markdown
  console.log("Generating and uploading markdown");
  const markdownContent = processedContent.slides
    .map(slide => `## Slide ${slide.index}\n\n${slide.content.join('\n\n')}\n\n`)
    .join('\n');

  const markdownBlob = new Blob([markdownContent], { type: 'text/markdown' });
  
  const markdownUploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/pptx_files/${markdownPath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
      },
      body: markdownBlob,
    }
  );

  if (!markdownUploadResponse.ok) {
    throw new Error(`Failed to upload Markdown file: ${markdownUploadResponse.statusText}`);
  }

  return { jsonPath, markdownPath };
}