import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { Slide, SlideShape } from './types.ts';

export function extractSlideTitle(sheet: XLSX.WorkSheet): string {
  const titleCells = ['A1', 'B1', 'C1'];
  for (const cell of titleCells) {
    if (sheet[cell] && sheet[cell].v) {
      return String(sheet[cell].v);
    }
  }
  return 'Untitled Slide';
}

export function extractNotes(sheet: XLSX.WorkSheet): string[] {
  const notes: string[] = [];
  if (sheet['!comments']) {
    Object.values(sheet['!comments']).forEach(comment => {
      if (comment.t) notes.push(comment.t);
    });
  }
  return notes;
}

export function extractShapes(sheet: XLSX.WorkSheet): SlideShape[] {
  const shapes: SlideShape[] = [];
  if (sheet['!drawings']) {
    sheet['!drawings'].forEach((drawing: any) => {
      if (drawing.shape) {
        shapes.push({
          type: drawing.shape.type || 'unknown',
          text: drawing.shape.text || ''
        });
      }
    });
  }
  return shapes;
}

export function processSheet(sheet: XLSX.WorkSheet, index: number): Slide {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  return {
    index: index + 1,
    title: extractSlideTitle(sheet),
    content: data.flat().filter(cell => cell && typeof cell === 'string'),
    notes: extractNotes(sheet),
    shapes: extractShapes(sheet)
  };
}