import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileRow } from "./FileRow";
import type { FileConversion } from "./types";

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
            <FileRow 
              key={file.id} 
              file={file} 
              onDelete={fetchFiles}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};