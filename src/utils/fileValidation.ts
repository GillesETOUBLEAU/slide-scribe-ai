const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

export const validateFile = (file: File): boolean => {
  if (!file) {
    throw new Error("No file selected");
  }

  if (!file.name.toLowerCase().endsWith('.pptx')) {
    throw new Error("Only .pptx files are allowed");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size must be less than 50MB. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
  }

  return true;
};