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
      const pptxPath = `${userId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("pptx_files")
        .upload(pptxPath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("file_conversions").insert({
        user_id: userId,
        original_filename: file.name,
        pptx_path: pptxPath,
      });

      if (dbError) throw dbError;

      toast({
        title: "File uploaded successfully",
        description: "Your file is being processed",
      });

      onUploadComplete();
    } catch (error) {
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