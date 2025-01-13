import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const createSupabaseClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
}

export const getFileData = async (supabase: any, fileId: string) => {
  console.log('Fetching file data from database')
  const { data, error } = await supabase
    .from('file_conversions')
    .select('*')
    .eq('id', fileId)
    .single()

  if (error) {
    console.error('Error fetching file data:', error)
    throw error
  }

  return data
}

export const downloadPPTX = async (supabase: any, pptxPath: string) => {
  console.log('Downloading PPTX file:', pptxPath)
  const { data, error } = await supabase
    .storage
    .from('pptx_files')
    .download(pptxPath)

  if (error) {
    console.error('Error downloading file:', error)
    throw error
  }

  return data
}

export const uploadProcessedFiles = async (
  supabase: any,
  jsonPath: string,
  markdownPath: string,
  jsonContent: any,
  markdownContent: string
) => {
  const jsonBlob = new Blob([JSON.stringify(jsonContent, null, 2)], { type: 'application/json' })
  const markdownBlob = new Blob([markdownContent], { type: 'text/markdown' })

  console.log('Uploading JSON file')
  const { error: jsonError } = await supabase
    .storage
    .from('pptx_files')
    .upload(jsonPath, jsonBlob)

  if (jsonError) throw jsonError

  console.log('Uploading Markdown file')
  const { error: markdownError } = await supabase
    .storage
    .from('pptx_files')
    .upload(markdownPath, markdownBlob)

  if (markdownError) throw markdownError
}

export const updateFileStatus = async (
  supabase: any,
  fileId: string,
  jsonPath: string,
  markdownPath: string
) => {
  console.log('Updating file conversion record')
  const { error } = await supabase
    .from('file_conversions')
    .update({
      json_path: jsonPath,
      markdown_path: markdownPath,
      status: 'completed'
    })
    .eq('id', fileId)

  if (error) throw error
}

export const extractSlideTitle = (sheet: any) => {
  const titleCells = ['A1', 'B1', 'C1']
  for (const cell of titleCells) {
    if (sheet[cell] && sheet[cell].v) {
      return sheet[cell].v.toString()
    }
  }
  return 'Untitled Slide'
}

export const extractNotes = (sheet: any) => {
  const notes = []
  if (sheet['!comments']) {
    Object.values(sheet['!comments']).forEach((comment: any) => {
      if (comment.t) notes.push(comment.t)
    })
  }
  return notes
}

export const extractShapes = (sheet: any) => {
  const shapes = []
  if (sheet['!drawings']) {
    sheet['!drawings'].forEach((drawing: any) => {
      if (drawing.shape) {
        shapes.push({
          type: drawing.shape.type,
          text: drawing.shape.text || ''
        })
      }
    })
  }
  return shapes
}

export const convertToMarkdown = (structuredContent: any) => {
  let markdown = `# ${structuredContent.metadata.lastModified}\n\n`

  structuredContent.slides.forEach((slide: any) => {
    markdown += `## Slide ${slide.index}: ${slide.title}\n\n`

    slide.content.forEach((text: string) => {
      if (text.trim()) {
        markdown += `${text}\n\n`
      }
    })

    if (slide.notes.length > 0) {
      markdown += '### Notes\n\n'
      slide.notes.forEach((note: string) => {
        markdown += `> ${note}\n\n`
      })
    }

    if (slide.shapes.length > 0) {
      markdown += '### Shapes\n\n'
      slide.shapes.forEach((shape: any) => {
        markdown += `- ${shape.type}: ${shape.text}\n`
      })
      markdown += '\n'
    }
  })

  return markdown
}

export const extractPPTXContent = async (file: ArrayBuffer) => {
  try {
    const workbook = XLSX.read(file, {
      type: 'array',
      cellStyles: true,
      cellFormulas: true,
      cellDates: true,
      cellNF: true,
      sheetStubs: true
    })

    const structuredContent = {
      metadata: {
        lastModified: new Date().toISOString(),
      },
      slides: []
    }

    workbook.SheetNames.forEach((sheetName, index) => {
      const sheet = workbook.Sheets[sheetName]
      const slideContent = {
        index: index + 1,
        title: extractSlideTitle(sheet),
        content: [],
        notes: extractNotes(sheet),
        shapes: extractShapes(sheet)
      }

      const textContent = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        .flat()
        .filter(cell => cell && typeof cell === 'string')

      slideContent.content = textContent
      structuredContent.slides.push(slideContent)
    })

    return {
      json: structuredContent,
      markdown: convertToMarkdown(structuredContent)
    }
  } catch (error) {
    console.error('Error processing PPTX:', error)
    throw error
  }
}