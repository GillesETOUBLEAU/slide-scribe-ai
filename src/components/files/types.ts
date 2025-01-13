export interface FileConversion {
  id: string;
  original_filename: string;
  status: string;
  created_at: string;
  json_path: string | null;
  markdown_path: string | null;
  pptx_path: string;
}