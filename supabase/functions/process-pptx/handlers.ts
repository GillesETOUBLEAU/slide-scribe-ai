import JSZip from "https://esm.sh/jszip@3.10.1";
import { parse as parseXML } from "https://deno.land/x/xml@2.1.3/mod.ts";
import type { FileData } from "./types.ts";
import { downloadFile, uploadProcessedFiles } from "./utils/fileOperations.ts";
import { updateFileStatus } from "./utils/databaseOperations.ts";
import { generateMarkdown } from "./utils/markdownGenerator.ts";

export async function handleFileProcessing(fileId: string, filePath: string) {
  console.log(`Starting processing for file: ${fileId}`);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    // Download and process the file
    const fileData = await downloadFile(supabaseUrl, supabaseKey, filePath);
    const processedData = await processFile(fileData);
    
    // Generate markdown
    const markdown = generateMarkdown(processedData);
    
    // Upload processed files
    const { jsonPath, markdownPath } = await uploadProcessedFiles(
      supabaseUrl,
      supabaseKey,
      filePath,
      processedData,
      markdown
    );

    // Update database record
    await updateFileStatus(supabaseUrl, supabaseKey, fileId, 'completed', {
      jsonPath,
      markdownPath
    });

    return { success: true };
  } catch (error) {
    console.error('Error processing file:', error);
    await updateFileStatus(
      supabaseUrl,
      supabaseKey,
      fileId,
      'error',
      undefined,
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
    throw error;
  }
}

async function processFile(fileData: ArrayBuffer): Promise<FileData> {
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(fileData);
  
  // Process presentation content
  const slideEntries = Object.entries(zipContent.files)
    .filter(([name]) => name.startsWith('ppt/slides/slide'))
    .sort(([a], [b]) => a.localeCompare(b));

  const slides = await Promise.all(
    slideEntries.map(async ([name, file], index) => {
      const content = await file.async('string');
      const xmlDoc = parseXML(content);
      
      if (!xmlDoc) {
        throw new Error('Failed to parse slide XML content');
      }
      
      return {
        index: index + 1,
        title: extractTitle(xmlDoc) || `Slide ${index + 1}`,
        content: extractContent(xmlDoc),
        notes: await extractNotes(zipContent, index + 1),
        shapes: extractShapes(xmlDoc)
      };
    })
  );

  return {
    metadata: {
      processedAt: new Date().toISOString(),
      filename: 'presentation.pptx',
      slideCount: slides.length,
    },
    slides,
  };
}

function extractTitle(doc: any): string {
  const titleNode = findNode(doc, 'p:title') || findNode(doc, 'title');
  return titleNode ? extractTextFromNode(titleNode) : '';
}

function extractContent(doc: any): string[] {
  const textNodes = findNodes(doc, 'a:t');
  return textNodes.map(node => extractTextFromNode(node)).filter(Boolean);
}

async function extractNotes(zip: JSZip, slideNumber: number): Promise<string[]> {
  const notesFile = zip.file(`ppt/notesSlides/notesSlide${slideNumber}.xml`);
  if (!notesFile) return [];

  const content = await notesFile.async('string');
  const xmlDoc = parseXML(content);
  
  if (!xmlDoc) return [];
  
  const noteNodes = findNodes(xmlDoc, 'a:t');
  return noteNodes.map(node => extractTextFromNode(node)).filter(Boolean);
}

function extractShapes(doc: any): { type: string; text: string; }[] {
  const shapes = findNodes(doc, 'p:sp');
  return shapes.map(shape => ({
    type: findNode(shape, 'p:nvSpPr')?.textContent?.trim() || 'shape',
    text: findNode(shape, 'a:t')?.textContent?.trim() || ''
  }));
}

function findNode(node: any, name: string): any {
  if (node.type === name) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, name);
      if (found) return found;
    }
  }
  return null;
}

function findNodes(node: any, name: string): any[] {
  const nodes: any[] = [];
  if (node.type === name) nodes.push(node);
  if (node.children) {
    for (const child of node.children) {
      nodes.push(...findNodes(child, name));
    }
  }
  return nodes;
}

function extractTextFromNode(node: any): string {
  if (!node) return '';
  if (typeof node.value === 'string') return node.value.trim();
  if (node.children) {
    return node.children
      .map((child: any) => extractTextFromNode(child))
      .join('')
      .trim();
  }
  return '';
}