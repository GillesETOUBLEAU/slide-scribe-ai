import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ProcessButtonProps {
  id: string;
  pptx_path: string;
  onProcess: () => void;
}

export const ProcessButton = ({ id, pptx_path, onProcess }: ProcessButtonProps) => {
  const { toast } = useToast();

  const handleProcess = async () => {
    try {
      const { data: { publicUrl } } = supabase.storage
        .from("pptx_files")
        .getPublicUrl(pptx_path);

      const { error } = await supabase.functions.invoke('process-pptx', {
        body: { 
          fileId: id,
          fileUrl: publicUrl
        }
      });

      if (error) throw error;

      toast({
        title: "Processing started",
        description: "Your file is being processed. This may take a few moments.",
      });

      onProcess();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  return (
    <Button
      onClick={handleProcess}
      size="sm"
      variant="outline"
      className="flex items-center gap-2"
    >
      <Play className="h-4 w-4" />
      Process
    </Button>
  );
};