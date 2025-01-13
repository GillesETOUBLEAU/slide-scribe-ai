import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useFileUpload } from "@/hooks/useFileUpload";

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
    <div className="mb-8">
      <Input
        type="file"
        accept=".pptx"
        onChange={handleFileUpload}
        disabled={uploading}
      />
      {uploading && (
        <div className="mt-2">
          <Progress value={progress} className="mb-2" />
          <p className="text-sm text-gray-500">
            {progress < 100 ? 'Uploading...' : 'Processing...'} {progress}%
          </p>
        </div>
      )}
    </div>
  );
};