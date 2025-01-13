export interface FileConversion {
  id: string;
  original_filename: string;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
  created_at: string;
  json_path: string | null;
  markdown_path: string | null;
  pptx_path: string;
  error_message?: string | null;
}