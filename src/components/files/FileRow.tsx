import { TableCell, TableRow } from "@/components/ui/table";
import { FileActions } from "./FileActions";
import type { FileConversion } from "./types";

interface FileRowProps {
  file: FileConversion;
  onDelete: () => void;
}

export const FileRow = ({ file, onDelete }: FileRowProps) => {
  return (
    <TableRow>
      <TableCell>{file.original_filename}</TableCell>
      <TableCell>{file.status}</TableCell>
      <TableCell>
        {new Date(file.created_at).toLocaleDateString()}
      </TableCell>
      <TableCell>
        <FileActions
          id={file.id}
          pptx_path={file.pptx_path}
          json_path={file.json_path}
          markdown_path={file.markdown_path}
          original_filename={file.original_filename}
          onDelete={onDelete}
        />
      </TableCell>
    </TableRow>
  );
};