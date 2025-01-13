import { toast } from "@/hooks/use-toast";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export const validateFile = (file: File): boolean => {
  if (!file.name.endsWith(".pptx")) {
    toast({
      variant: "destructive",
      title: "Invalid file",
      description: "Please upload a PPTX file",
    });
    return false;
  }

  if (file.size > MAX_FILE_SIZE) {
    toast({
      variant: "destructive",
      title: "File too large",
      description: "Maximum file size is 500MB",
    });
    return false;
  }

  return true;
};