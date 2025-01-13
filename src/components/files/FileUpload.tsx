import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface FileUploadProps {
  userId: string;
  onUploadComplete: () => void;
}

export const FileUpload = ({ userId, onUploadComplete }: FileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.name.endsWith(".pptx")) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please upload a PPTX file",
      });
      return;
    }

    // Check file size before uploading
    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Maximum file size is 500MB",
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      console.log("Starting file upload process");
      const pptxPath = `${userId}/${crypto.randomUUID()}-${file.name}`;
      
      // Upload file to storage
      console.log("Uploading file to storage");
      const { error: uploadError } = await supabase.storage
        .from("pptx_files")
        .upload(pptxPath, file);

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

      // Trigger processing
      console.log("Triggering processing function", fileData.id);
      const { data: processData, error: processError } = await supabase.functions.invoke('process-pptx', {
        body: { fileId: fileData.id }
      });

      if (processError) {
        console.error("Processing error:", processError);
        toast({
          variant: "destructive",
          title: "Processing failed",
          description: "The file could not be processed. Please try again with a smaller file.",
        });
        return;
      }

      if (processData.status === 'error') {
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

  return (
    <div className="mb-8">
      <Input
        type="file"
        accept=".pptx"
        onChange={handleFileUpload}
        disabled={uploading}
      />
      {uploading && <Progress value={progress} className="mt-2" />}
    </div>
  );
};