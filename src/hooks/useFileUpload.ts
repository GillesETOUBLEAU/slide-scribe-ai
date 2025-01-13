import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validateFile } from "@/utils/fileValidation";

export const useFileUpload = (userId: string, onUploadComplete: () => void) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const uploadFile = async (file: File) => {
    if (!validateFile(file)) return;

    setUploading(true);
    setProgress(0);

    try {
      console.log("Starting file upload process");
      const pptxPath = `${userId}/${crypto.randomUUID()}-${file.name}`;
      
      // Upload file to storage with progress tracking
      console.log("Uploading file to storage");
      const { error: uploadError } = await supabase.storage
        .from("pptx_files")
        .upload(pptxPath, file, {
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      // Create database record
      console.log("Creating database record");
      const { error: dbError } = await supabase
        .from("file_conversions")
        .insert({
          user_id: userId,
          original_filename: file.name,
          pptx_path: pptxPath,
          status: 'uploaded'  // Changed from 'processing' to 'uploaded'
        });

      if (dbError) throw dbError;

      toast({
        title: "File uploaded",
        description: "Your file has been uploaded. Click 'Process' to start processing.",
      });

      onUploadComplete();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return {
    uploading,
    progress,
    uploadFile
  };
};