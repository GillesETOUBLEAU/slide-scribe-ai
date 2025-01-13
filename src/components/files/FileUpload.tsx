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
        throw processError;
      }

      console.log("Processing response:", processData);

      toast({
        title: "File uploaded successfully",
        description: "Your file is being processed. You'll see the results shortly.",
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