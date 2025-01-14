import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validateFile } from "@/utils/fileValidation";

export const useFileUpload = (userId: string, onUploadComplete: () => void) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const sanitizeFilename = (filename: string): string => {
    // Remove diacritics/accents
    const normalized = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Replace spaces and special characters with underscores
    return normalized.replace(/[^a-zA-Z0-9.-]/g, '_');
  };

  const uploadFile = async (file: File) => {
    if (!validateFile(file)) return;

    setUploading(true);
    setProgress(0);

    try {
      console.log("Starting file upload process for:", file.name);
      
      // Sanitize the filename while keeping the extension
      const extension = file.name.split('.').pop();
      const sanitizedName = sanitizeFilename(file.name);
      const pptxPath = `${userId}/${crypto.randomUUID()}-${sanitizedName}`;
      
      // Create a new File object with the sanitized name
      const sanitizedFile = new File([file], sanitizedName, { type: file.type });
      
      // Upload file to storage with progress tracking
      console.log("Uploading file to storage at path:", pptxPath);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("pptx_files")
        .upload(pptxPath, sanitizedFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw uploadError;
      }

      console.log("File uploaded successfully:", uploadData);

      // Create database record
      console.log("Creating database record");
      const { data: dbData, error: dbError } = await supabase
        .from("file_conversions")
        .insert({
          user_id: userId,
          original_filename: file.name, // Keep original filename for display
          pptx_path: pptxPath,
          status: 'uploaded'
        })
        .select()
        .single();

      if (dbError) {
        console.error("Database insert error:", dbError);
        throw dbError;
      }

      console.log("Database record created:", dbData);

      toast({
        title: "File uploaded",
        description: "Your file has been uploaded. Click 'Process' to start processing.",
      });

      setProgress(100);
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
