export async function extractSlideFiles(zipContent: any): Promise<string[]> {
  console.log("Extracting slide files from PPTX");
  
  const slideFiles = Object.keys(zipContent.files)
    .filter(name => name.match(/ppt\/slides\/slide[0-9]+\.xml/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide([0-9]+)\.xml/)?.[1] || '0');
      const numB = parseInt(b.match(/slide([0-9]+)\.xml/)?.[1] || '0');
      return numA - numB;
    });

  console.log("Found slide files:", slideFiles);
  return slideFiles;
}

export async function getSlideContent(zipContent: any, slideFile: string): Promise<string> {
  console.log(`Getting content for slide: ${slideFile}`);
  
  const file = zipContent.files[slideFile];
  if (!file) {
    throw new Error(`Slide file not found: ${slideFile}`);
  }

  const content = await file.async("text");
  console.log(`Retrieved content for ${slideFile}`);
  return content;
}