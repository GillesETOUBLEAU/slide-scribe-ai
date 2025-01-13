import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FileConversion {
  id: string;
  original_filename: string;
  status: string;
  created_at: string;
  json_path: string | null;
  markdown_path: string | null;
  pptx_path: string;
}

export const FileList = () => {
  const [files, setFiles] = useState<FileConversion[]>([]);
  const { toast } = useToast();

  const fetchFiles = async () => {
    const { data, error } = await supabase
      .from("file_conversions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error fetching files",
        description: error.message,
      });
      return;
    }

    setFiles(data || []);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDelete = async (file: FileConversion) => {
    try {
      // Delete the file from storage
      const { error: storageError } = await supabase.storage
        .from("pptx_files")
        .remove([file.pptx_path]);

      if (storageError) throw storageError;

      // Delete JSON file if it exists
      if (file.json_path) {
        await supabase.storage
          .from("pptx_files")
          .remove([file.json_path]);
      }

      // Delete Markdown file if it exists
      if (file.markdown_path) {
        await supabase.storage
          .from("pptx_files")
          .remove([file.markdown_path]);
      }

      // Delete the database record
      const { error: dbError } = await supabase
        .from("file_conversions")
        .delete()
        .eq("id", file.id);

      if (dbError) throw dbError;

      toast({
        title: "File deleted",
        description: "The file has been successfully deleted.",
      });

      // Refresh the file list
      fetchFiles();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

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

  return (
    <div className="bg-white rounded-lg shadow">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Filename</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.id}>
              <TableCell>{file.original_filename}</TableCell>
              <TableCell>{file.status}</TableCell>
              <TableCell>
                {new Date(file.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-4">
                  <div className="space-x-2">
                    {file.json_path && (
                      <button
                        onClick={() =>
                          downloadFile(
                            file.json_path!,
                            file.original_filename.replace(".pptx", ".json")
                          )
                        }
                        className="text-blue-600 hover:text-blue-800"
                      >
                        JSON
                      </button>
                    )}
                    {file.markdown_path && (
                      <button
                        onClick={() =>
                          downloadFile(
                            file.markdown_path!,
                            file.original_filename.replace(".pptx", ".md")
                          )
                        }
                        className="text-blue-600 hover:text-blue-800"
                      >
                        MD
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(file)}
                    className="text-red-600 hover:text-red-800"
                    title="Delete file"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};