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
      const { data: fileData, error: dbError } = await supabase
        .from("file_conversions")
        .insert({
          user_id: userId,
          original_filename: file.name,
          pptx_path: pptxPath,
          status: 'processing'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Get file URL for processing
      const { data: { publicUrl } } = supabase.storage
        .from("pptx_files")
        .getPublicUrl(pptxPath);

      // Trigger processing with file URL instead of raw file
      console.log("Triggering processing function", fileData.id);
      const { data: processData, error: processError } = await supabase.functions.invoke('process-pptx', {
        body: { 
          fileId: fileData.id,
          fileUrl: publicUrl
        }
      });

      if (processError) {
        console.error("Processing error:", processError);
        toast({
          variant: "destructive",
          title: "Processing failed",
          description: "The file could not be processed. Please try again.",
        });
        return;
      }

      if (processData?.status === 'error') {
        toast({
          variant: "destructive",
          title: "Processing failed",
          description: processData.details || "An error occurred while processing the file.",
        });
      } else {
        toast({
          title: "File uploaded",
          description: "Your file has been uploaded and is being processed.",
        });
      }

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