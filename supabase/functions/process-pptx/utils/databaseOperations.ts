export async function updateFileStatus(
  supabaseUrl: string,
  supabaseKey: string,
  fileId: string,
  status: 'processing' | 'completed' | 'error',
  paths?: { jsonPath?: string; markdownPath?: string },
  errorMessage?: string
) {
  const updateData: Record<string, unknown> = { status };
  
  if (paths) {
    if (paths.jsonPath) updateData.json_path = paths.jsonPath;
    if (paths.markdownPath) updateData.markdown_path = paths.markdownPath;
  }
  
  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/file_conversions?id=eq.${fileId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(updateData),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update file status: ${response.statusText}`);
  }
}