export interface FileData {
  metadata: {
    processedAt: string;
    filename: string;
  };
  content: string[];
}