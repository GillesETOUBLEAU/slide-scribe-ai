import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

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

  if (error) {
    console.error('Error fetching file data:', error);
    throw error;
  }

  if (!data) {
    console.error('No file data found');
    throw new Error('File not found');
  }

  return data;
};

export const downloadPPTX = async (supabase: any, pptxPath: string) => {
  console.log('Downloading PPTX from path:', pptxPath);
  const { data, error } = await supabase
    .storage
    .from('pptx_files')
    .download(pptxPath);

  if (error) {
    console.error('Error downloading PPTX:', error);
    throw error;
  }

  if (!data) {
    console.error('No file content received');
    throw new Error('Failed to download file content');
  }

  return data;
};

export const uploadProcessedFiles = async (
  supabase: any,
  jsonPath: string,
  markdownPath: string,
  jsonContent: any,
  markdownContent: string
) => {
  console.log('Uploading processed files');
  console.log('JSON path:', jsonPath);
  console.log('Markdown path:', markdownPath);

  const jsonBlob = new Blob([JSON.stringify(jsonContent, null, 2)], { type: 'application/json' });
  const markdownBlob = new Blob([markdownContent], { type: 'text/markdown' });

  // Upload JSON
  const { error: jsonError } = await supabase
    .storage
    .from('pptx_files')
    .upload(jsonPath, jsonBlob);

  if (jsonError) {
    console.error('Error uploading JSON:', jsonError);
    throw jsonError;
  }

  // Upload Markdown
  const { error: markdownError } = await supabase
    .storage
    .from('pptx_files')
    .upload(markdownPath, markdownBlob);

  if (markdownError) {
    console.error('Error uploading Markdown:', markdownError);
    throw markdownError;
  }

  console.log('Files uploaded successfully');
};

export const updateFileStatus = async (
  supabase: any,
  fileId: string,
  jsonPath: string,
  markdownPath: string
) => {
  console.log('Updating file status for ID:', fileId);
  const { error } = await supabase
    .from('file_conversions')
    .update({
      json_path: jsonPath,
      markdown_path: markdownPath,
      status: 'completed'
    })
    .eq('id', fileId);

  if (error) {
    console.error('Error updating file status:', error);
    throw error;
  }

  console.log('File status updated successfully');
};

export const extractPPTXContent = async (file: ArrayBuffer) => {
  console.log('Starting PPTX content extraction');
  try {
    const workbook = XLSX.read(file, {
      type: 'array',
      cellStyles: true,
      cellFormulas: true,
      cellDates: true,
      cellNF: true,
      sheetStubs: true
    });

    console.log('Workbook loaded successfully');
    console.log('Number of sheets:', workbook.SheetNames.length);

    const structuredContent = {
      metadata: {
        lastModified: new Date().toISOString(),
        sheetCount: workbook.SheetNames.length
      },
      slides: []
    };

    workbook.SheetNames.forEach((sheetName, index) => {
      console.log(`Processing sheet ${index + 1}: ${sheetName}`);
      const sheet = workbook.Sheets[sheetName];
      
      // Extract text content
      const textContent = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        .flat()
        .filter(cell => cell && typeof cell === 'string');

      console.log(`Sheet ${index + 1} content length:`, textContent.length);

      structuredContent.slides.push({
        index: index + 1,
        name: sheetName,
        content: textContent
      });
    });

    console.log('Content extraction completed');
    return {
      json: structuredContent,
      markdown: convertToMarkdown(structuredContent)
    };
  } catch (error) {
    console.error('Error in PPTX extraction:', error);
    throw error;
  }
};

const convertToMarkdown = (structuredContent: any) => {
  console.log('Converting content to markdown');
  let markdown = `# Presentation Content\n\n`;
  markdown += `Last Modified: ${structuredContent.metadata.lastModified}\n\n`;

  structuredContent.slides.forEach((slide: any) => {
    markdown += `## Slide ${slide.index}: ${slide.name}\n\n`;
    
    slide.content.forEach((text: string) => {
      if (text.trim()) {
        markdown += `${text}\n\n`;
      }
    });
  });

  console.log('Markdown conversion completed');
  return markdown;
};