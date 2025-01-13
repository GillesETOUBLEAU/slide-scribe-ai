import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FileActionsProps {
  id: string;
  pptx_path: string;
  json_path: string | null;
  markdown_path: string | null;
  original_filename: string;
  onDelete: () => void;
}

export const FileActions = ({
  id,
  pptx_path,
  json_path,
  markdown_path,
  original_filename,
  onDelete,
}: FileActionsProps) => {
  const { toast } = useToast();

  const downloadFile = async (path: string, filename: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("pptx_files")
        .download(path);

      if (error) throw error;

      const blob = new Blob([data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

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
      <div className="space-x-2">
        {json_path && (
          <button
            onClick={() =>
              downloadFile(
                json_path,
                original_filename.replace(".pptx", ".json")
              )
            }
            className="text-blue-600 hover:text-blue-800"
          >
            JSON
          </button>
        )}
        {markdown_path && (
          <button
            onClick={() =>
              downloadFile(
                markdown_path,
                original_filename.replace(".pptx", ".md")
              )
            }
            className="text-blue-600 hover:text-blue-800"
          >
            MD
          </button>
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