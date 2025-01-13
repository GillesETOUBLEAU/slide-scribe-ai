import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DownloadButton } from "./DownloadButton";
import { ProcessButton } from "./ProcessButton";
import type { FileActionsProps } from "./types/fileActions";

export const FileActions = ({
  id,
  pptx_path,
  json_path,
  markdown_path,
  original_filename,
  status,
  onDelete,
}: FileActionsProps) => {
  const { toast } = useToast();

  const handleDelete = async () => {
    try {
      // Delete the file from storage
      const { error: storageError } = await supabase.storage
        .from("pptx_files")
        .remove([pptx_path]);

      if (storageError) throw storageError;

      // Delete JSON file if it exists
      if (json_path) {
        await supabase.storage
          .from("pptx_files")
          .remove([json_path]);
      }

      // Delete Markdown file if it exists
      if (markdown_path) {
        await supabase.storage
          .from("pptx_files")
          .remove([markdown_path]);
      }

      // Delete the database record
      const { error: dbError } = await supabase
        .from("file_conversions")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      toast({
        title: "File deleted",
        description: "The file has been successfully deleted.",
      });

      onDelete();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  return (
    <div className="flex items-center space-x-4">
      {status === 'uploaded' && (
        <ProcessButton 
          id={id} 
          pptx_path={pptx_path} 
          onProcess={onDelete}
        />
      )}
      <div className="space-x-2">
        {json_path && (
          <DownloadButton
            path={json_path}
            filename={original_filename.replace(".pptx", ".json")}
            label="JSON"
          />
        )}
        {markdown_path && (
          <DownloadButton
            path={markdown_path}
            filename={original_filename.replace(".pptx", ".md")}
            label="MD"
          />
        )}
      </div>
      <button
        onClick={handleDelete}
        className="text-red-600 hover:text-red-800"
        title="Delete file"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};