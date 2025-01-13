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
    console.log("Fetching files...");
    const { data, error } = await supabase
      .from("file_conversions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching files:", error);
      toast({
        variant: "destructive",
        title: "Error fetching files",
        description: error.message,
      });
      return;
    }

    // Cast the status to ensure it matches the FileConversion type
    const typedData = (data || []).map(file => ({
      ...file,
      status: file.status as FileConversion['status']
    }));

    console.log("Files fetched:", typedData);
    setFiles(typedData);
  };

  // Set up real-time subscription for status updates
  useEffect(() => {
    const subscription = supabase
      .channel('file_conversions_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'file_conversions' 
        }, 
        () => {
          console.log("Received database change, refreshing files...");
          fetchFiles();
        }
      )
      .subscribe();

    // Initial fetch
    fetchFiles();

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
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