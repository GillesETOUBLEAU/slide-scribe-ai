export interface SlideShape {
  type: string;
  text: string;
}

export interface Slide {
  index: number;
  title: string;
  content: string[];
  notes: string[];
  shapes: SlideShape[];
}

export interface ProcessedContent {
  metadata: {
    processedAt: string;
    sheetCount: number;
  };
  slides: Slide[];
}