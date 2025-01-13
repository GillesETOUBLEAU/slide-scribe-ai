import JSZip from "https://esm.sh/jszip@3.10.1";
import { parse as parseXML } from "https://deno.land/x/xml@2.1.3/mod.ts";
import type { FileData } from "./types.ts";

export async function handleFileProcessing(fileId: string, filePath: string) {
  console.log(`Starting processing for file: ${fileId}`);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    // Download the PPTX file using REST API
    const storageResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/authenticated/pptx_files/${filePath}`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
      }
    );

    if (!storageResponse.ok) {
      throw new Error(`Failed to download file: ${storageResponse.statusText}`);
    }

    const fileData = await storageResponse.arrayBuffer();
    
    // Process the file
    const processedData = await processFile(fileData);
    
    // Save JSON output
    const jsonPath = filePath.replace('.pptx', '.json');
    const jsonBlob = new Blob([JSON.stringify(processedData, null, 2)], {
      type: 'application/json',
    });
    
    const jsonUploadResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/pptx_files/${jsonPath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
          'Content-Type': 'application/json',
        },
        body: jsonBlob,
      }
    );

    if (!jsonUploadResponse.ok) {
      throw new Error(`Failed to upload JSON: ${jsonUploadResponse.statusText}`);
    }

    // Generate and save markdown
    const markdown = generateMarkdown(processedData);
    const markdownPath = filePath.replace('.pptx', '.md');
    const markdownBlob = new Blob([markdown], { type: 'text/markdown' });
    
    const markdownUploadResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/pptx_files/${markdownPath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
          'Content-Type': 'text/markdown',
        },
        body: markdownBlob,
      }
    );

    if (!markdownUploadResponse.ok) {
      throw new Error(`Failed to upload Markdown: ${markdownUploadResponse.statusText}`);
    }

    // Update database record
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/file_conversions?id=eq.${fileId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status: 'completed',
          json_path: jsonPath,
          markdown_path: markdownPath,
        }),
      }
    );

    if (!updateResponse.ok) {
      throw new Error(`Failed to update record: ${updateResponse.statusText}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error processing file:', error);

    // Update database record with error
    await fetch(
      `${supabaseUrl}/rest/v1/file_conversions?id=eq.${fileId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error occurred',
        }),
      }
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

function generateMarkdown(content: FileData): string {
  let markdown = `# Presentation Content\n\n`;
  markdown += `Processed at: ${content.metadata.processedAt}\n\n`;

  content.slides.forEach((slide) => {
    markdown += `## Slide ${slide.index}: ${slide.title}\n\n`;
    
    // Add content
    slide.content.forEach((text) => {
      markdown += `${text}\n\n`;
    });

    // Add notes if present
    if (slide.notes.length > 0) {
      markdown += `### Notes\n\n`;
      slide.notes.forEach((note) => {
        markdown += `- ${note}\n`;
      });
      markdown += '\n';
    }

    // Add shapes if present
    if (slide.shapes.length > 0) {
      markdown += `### Shapes\n\n`;
      slide.shapes.forEach((shape) => {
        markdown += `- ${shape.type}: ${shape.text}\n`;
      });
      markdown += '\n';
    }
  });

  return markdown;
}