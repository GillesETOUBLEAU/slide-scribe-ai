import JSZip from "https://esm.sh/jszip@3.10.1";

export async function extractSlideFiles(zipContent: JSZip): Promise<string[]> {
  return Object.keys(zipContent.files)
    .filter(name => name.match(/ppt\/slides\/slide[0-9]+\.xml/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide([0-9]+)\.xml/)?.[1] || '0');
      const numB = parseInt(b.match(/slide([0-9]+)\.xml/)?.[1] || '0');
      return numA - numB;
    });
}

export async function getSlideContent(zipContent: JSZip, slideFile: string): Promise<string> {
  const content = await zipContent.files[slideFile].async('string');
  console.log(`Raw slide content length for ${slideFile}:`, content.length);
  return content;
}