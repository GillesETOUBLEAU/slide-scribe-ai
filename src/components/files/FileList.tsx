import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};