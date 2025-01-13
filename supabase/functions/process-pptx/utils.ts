export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function updateFileStatus(supabaseUrl: string, supabaseKey: string, fileId: string, status: string, errorMessage?: string) {
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
      body: JSON.stringify({
        status,
        ...(errorMessage && { error_message: errorMessage }),
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update file status: ${response.statusText}`);
  }
}