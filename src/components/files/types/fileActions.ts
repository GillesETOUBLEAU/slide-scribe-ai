export interface FileActionsProps {
  id: string;
  pptx_path: string;
  json_path: string | null;
  markdown_path: string | null;
  original_filename: string;
  status: string;
  onDelete: () => void;
}

export interface DownloadButtonProps {
  path: string;
  filename: string;
  label: string;
}