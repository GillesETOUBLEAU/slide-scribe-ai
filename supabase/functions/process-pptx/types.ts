export interface FileData {
  metadata: {
    processedAt: string;
    filename: string;
    slideCount: number;
  };
  slides: Slide[];
}

export interface Slide {
  index: number;
  title: string;
  content: string[];
  notes: string[];
  shapes: SlideShape[];
}

export interface SlideShape {
  type: string;
  text: string;
}