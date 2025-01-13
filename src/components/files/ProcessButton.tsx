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
      console.log("Starting processing for file:", id);
      
      // Update status to processing
      const { error: updateError } = await supabase
        .from("file_conversions")
        .update({ status: 'processing' })
        .eq('id', id);

      if (updateError) {
        console.error("Error updating status:", updateError);
        throw updateError;
      }

      console.log("Invoking process-pptx function with payload:", { fileId: id, filePath: pptx_path });

      // Call the edge function to process the file
      const { data, error } = await supabase.functions.invoke('process-pptx', {
        body: { 
          fileId: id,
          filePath: pptx_path
        }
      });

      if (error) {
        console.error("Error from edge function:", error);
        throw error;
      }

      console.log("Function response:", data);

      toast({
        title: "Processing started",
        description: "Your file is being processed. This may take a few moments.",
      });

      // Trigger refresh of file list
      onProcess();
    } catch (error) {
      console.error("Processing failed:", error);
      
      // Update status back to uploaded if processing fails to start
      await supabase
        .from("file_conversions")
        .update({ 
          status: 'uploaded',
          error_message: error instanceof Error ? error.message : "Unknown error occurred"
        })
        .eq('id', id);

      toast({
        variant: "destructive",
        title: "Processing failed",
        description: "Failed to start processing. Please try again.",
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