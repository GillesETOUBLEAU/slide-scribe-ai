import { FileData } from "../types.ts";

export async function downloadFile(supabaseUrl: string, supabaseKey: string, filePath: string): Promise<ArrayBuffer> {
  const storageResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/authenticated/pptx_files/${filePath}`,
    {
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
      },
    }
  );

  if (!storageResponse.ok) {
    throw new Error(`Failed to download file: ${storageResponse.statusText}`);
  }

  return storageResponse.arrayBuffer();
}

export async function uploadProcessedFiles(
  supabaseUrl: string,
  supabaseKey: string,
  filePath: string,
  processedData: FileData,
  markdown: string
): Promise<{ jsonPath: string; markdownPath: string }> {
  const jsonPath = filePath.replace('.pptx', '.json');
  const markdownPath = filePath.replace('.pptx', '.md');

  // Upload JSON
  const jsonBlob = new Blob([JSON.stringify(processedData, null, 2)], {
    type: 'application/json',
  });
  
  const jsonUploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/pptx_files/${jsonPath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
        'Content-Type': 'application/json',
      },
      body: jsonBlob,
    }
  );

  if (!jsonUploadResponse.ok) {
    throw new Error(`Failed to upload JSON: ${jsonUploadResponse.statusText}`);
  }

  // Upload markdown
  const markdownBlob = new Blob([markdown], { type: 'text/markdown' });
  
  const markdownUploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/pptx_files/${markdownPath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
        'Content-Type': 'text/markdown',
      },
      body: markdownBlob,
    }
  );

  if (!markdownUploadResponse.ok) {
    throw new Error(`Failed to upload Markdown: ${markdownUploadResponse.statusText}`);
  }

  return { jsonPath, markdownPath };
}