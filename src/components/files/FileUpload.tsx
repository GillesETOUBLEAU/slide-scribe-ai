import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useFileUpload } from "@/hooks/useFileUpload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface FileUploadProps {
  userId: string;
  onUploadComplete: () => void;
}

export const FileUpload = ({ userId, onUploadComplete }: FileUploadProps) => {
  const { uploading, progress, uploadFile } = useFileUpload(userId, onUploadComplete);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  return (
    <div className="mb-8 space-y-4">
      <Input
        type="file"
        accept=".pptx"
        onChange={handleFileUpload}
        disabled={uploading}
        className="cursor-pointer"
      />
      {uploading && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <Alert>
            <AlertDescription className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {progress < 100 ? 'Uploading...' : 'Processing...'} {progress}%
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
};