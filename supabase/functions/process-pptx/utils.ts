export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const createSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    throw new Error('Missing required environment variables');
  }

  return createClient(supabaseUrl, supabaseKey);
};

export const getFileData = async (supabase: any, fileId: string) => {
  console.log('Getting file data for ID:', fileId);
  const { data, error } = await supabase
    .from('file_conversions')
    .select('*')
    .eq('id', fileId)
    .single();

  if (error) throw error;
  if (!data) throw new Error('File not found');

  return data;
};

export const downloadPPTX = async (supabase: any, pptxPath: string) => {
  console.log('Downloading PPTX from path:', pptxPath);
  const { data, error } = await supabase
    .storage
    .from('pptx_files')
    .download(pptxPath);

  if (error) throw error;
  if (!data) throw new Error('Failed to download file content');

  return data;
};

export const uploadFile = async (supabase: any, bucket: string, path: string, content: Blob) => {
  const { error } = await supabase
    .storage
    .from(bucket)
    .upload(path, content, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;
};

export const updateFileStatus = async (
  supabase: any,
  fileId: string,
  status: string,
  updates: Record<string, any> = {}
) => {
  const { error } = await supabase
    .from('file_conversions')
    .update({
      status,
      ...updates
    })
    .eq('id', fileId);

  if (error) throw error;
};