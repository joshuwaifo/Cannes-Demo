// server/services/pdf-generation-service.ts
import { PDFDocument, StandardFonts, rgb, PDFFont, PageSizes } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Screenplay Formatting Constants (inches to PDF points: 1 inch = 72 points)
const INCH = 72;

const PAGE_WIDTH = 8.5 * INCH;
const PAGE_HEIGHT = 11 * INCH;

const MARGIN_TOP = 1 * INCH;
const MARGIN_BOTTOM = 1 * INCH;
const MARGIN_LEFT = 1.5 * INCH; // Standard left margin
const MARGIN_RIGHT = 1 * INCH;  // Standard right margin

const FONT_SIZE = 12;
const LINE_HEIGHT = FONT_SIZE; // Courier is monospaced, leading handled by lines.

// Element-specific X positions (from left margin of page)
const SCENE_HEADING_X_ABS = 1.5 * INCH;
const ACTION_X_ABS = 1.5 * INCH;
const CHARACTER_NAME_X_ABS = 3.7 * INCH; // Roughly
const PARENTHETICAL_X_ABS = 3.1 * INCH;  // Roughly
const DIALOGUE_X_ABS = 2.5 * INCH;       // Roughly
const TRANSITION_X_ABS = 6.0 * INCH;     // Roughly (often right aligned)

// Max widths for elements (from their X position)
const SCENE_HEADING_MAX_WIDTH_CHARS = 60;
const ACTION_MAX_WIDTH_CHARS = 60;
const CHARACTER_NAME_MAX_WIDTH_CHARS = 30; // Usually short
const PARENTHETICAL_MAX_WIDTH_CHARS = 25;
const DIALOGUE_MAX_WIDTH_CHARS = 35;
const TRANSITION_MAX_WIDTH_CHARS = 25;


enum ElementType {
  SCENE_HEADING,
  ACTION,
  CHARACTER_NAME,
  PARENTHETICAL,
  DIALOGUE,
  TRANSITION,
  EMPTY_LINE,
  PAGE_BREAK, // For (MORE) and (CONT'D) type logic if ever implemented
  UNKNOWN
}

function determineElementType(line: string, nextLine?: string): ElementType {
    const trimmedLine = line.trim();
    if (trimmedLine === '') return ElementType.EMPTY_LINE;

    // Scene Headings (INT. LOCATION - TIME or EXT. LOCATION - DAY)
    if (/^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\.?\/E\.?|INT\.?|EXT\.)\s*.*?(?:-\s*(DAY|NIGHT|MORNING|EVENING|AFTERNOON|LATER|CONTINUOUS|SAME)\b.*)?$/i.test(trimmedLine) && trimmedLine === trimmedLine.toUpperCase()) {
        return ElementType.SCENE_HEADING;
    }
    // Transitions (FADE IN:, CUT TO:, etc.)
    if (/^(FADE\s+(IN|OUT|TO BLACK)|CUT\s+TO|DISSOLVE\s+TO|MATCH\s+CUT\s+TO|CONTINUED):?$/i.test(trimmedLine) && trimmedLine === trimmedLine.toUpperCase() && trimmedLine.endsWith(':')) {
        return ElementType.TRANSITION;
    }
    // Parentheticals ((whispering), (beat), etc.)
    if (trimmedLine.startsWith('(') && trimmedLine.endsWith(')')) {
        return ElementType.PARENTHETICAL;
    }
    // Character Names (ALL CAPS, usually followed by dialogue or parenthetical)
    // Heuristic: ALL CAPS, less than ~35 chars, not a scene heading, and next line might be dialogue/parenthetical
    if (trimmedLine === trimmedLine.toUpperCase() &&
        trimmedLine.length > 0 &&
        trimmedLine.length < 35 &&
        !trimmedLine.includes(' EXT.') && !trimmedLine.includes(' INT.') &&
        !trimmedLine.endsWith(':') && // Transitions usually end with :
        (nextLine === undefined || nextLine.trim().startsWith('(') || (nextLine.trim() && !/^(INT|EXT)/.test(nextLine.trim().toUpperCase())) )
       ) {
        return ElementType.CHARACTER_NAME;
    }
    // Dialogue (typically follows a Character Name or Parenthetical)
    // This is the hardest to detect without context; for now, if it's not anything else and has some indentation (from AI)
    if (line.startsWith('  ') && !trimmedLine.startsWith('(')) { // Crude check for indentation
        return ElementType.DIALOGUE;
    }
    // Default to Action
    return ElementType.ACTION;
}


async function addTextToPage(
    page: any,
    text: string,
    x: number,
    y: number,
    font: PDFFont,
    size: number,
    maxWidthChars: number,
    lineHeight: number
): Promise<number> {
    let currentY = y;
    const words = text.split(' ');
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        if (testLine.length > maxWidthChars && currentLine) {
            page.drawText(currentLine, { x, y: currentY, font, size, color: rgb(0, 0, 0) });
            currentLine = word;
            currentY -= lineHeight;
            if (currentY < MARGIN_BOTTOM) return currentY; // Signal page break needed
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        page.drawText(currentLine, { x, y: currentY, font, size, color: rgb(0, 0, 0) });
        currentY -= lineHeight;
    }
    return currentY;
}


export async function generateScriptPdf(scriptContent: string, title: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  let courierFont: PDFFont;
  try {
    // For a production environment, you would bundle the font file (e.g., CourierPrime-Regular.ttf)
    // For this example, we'll stick to the standard Courier to avoid file path issues.
    // If you have Courier Prime or another screenplay font:
    // const fontBytes = fs.readFileSync(path.resolve(__dirname, './fonts/CourierPrime-Regular.ttf'));
    // courierFont = await pdfDoc.embedFont(fontBytes);
    courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
  } catch (e) {
    console.warn("Failed to embed custom Courier font, using standard Courier.", e);
    courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
  }

  let currentPage = pdfDoc.addPage(PageSizes.Letter);
  let currentY = PAGE_HEIGHT - MARGIN_TOP;
  let pageNumber = 0; // Title page is not numbered

  // --- Title Page ---
  const titleFontSize = 18;
  const authorFontSize = 14;
  const titleWidth = courierFont.widthOfTextAtSize(title.toUpperCase(), titleFontSize);
  currentPage.drawText(title.toUpperCase(), {
    x: PAGE_WIDTH / 2 - titleWidth / 2,
    y: PAGE_HEIGHT / 2 + INCH, // Centered vertically a bit
    font: courierFont,
    size: titleFontSize,
    color: rgb(0, 0, 0),
  });
  const byLine = "by";
  const byLineWidth = courierFont.widthOfTextAtSize(byLine, FONT_SIZE);
  currentPage.drawText(byLine, {
    x: PAGE_WIDTH / 2 - byLineWidth / 2,
    y: PAGE_HEIGHT / 2 + INCH - titleFontSize - (0.5 * INCH),
    font: courierFont,
    size: FONT_SIZE,
    color: rgb(0,0,0)
  });
  const authorName = "Vadis AI Script Writer";
  const authorNameWidth = courierFont.widthOfTextAtSize(authorName, authorFontSize);
   currentPage.drawText(authorName, {
    x: PAGE_WIDTH / 2 - authorNameWidth / 2,
    y: PAGE_HEIGHT / 2 + INCH - titleFontSize - (0.5 * INCH) - authorFontSize - (0.2 * INCH),
    font: courierFont,
    size: authorFontSize,
    color: rgb(0, 0, 0),
  });


  // --- Script Content ---
  const lines = scriptContent.split('\n');
  let firstPageOfScript = true;

  const newPage = () => {
    currentPage = pdfDoc.addPage(PageSizes.Letter);
    currentY = PAGE_HEIGHT - MARGIN_TOP;
    pageNumber++;
    if (!firstPageOfScript && pageNumber > 1) { // Don't number page 1 of script
        const pageNumStr = String(pageNumber -1) + "."; // Page numbers are usually X.
        currentPage.drawText(pageNumStr, {
            x: PAGE_WIDTH - MARGIN_RIGHT - courierFont.widthOfTextAtSize(pageNumStr, FONT_SIZE),
            y: PAGE_HEIGHT - (0.5 * INCH), // Approx 0.5" from top edge
            font: courierFont,
            size: FONT_SIZE,
            color: rgb(0, 0, 0)
        });
    }
    if (firstPageOfScript) firstPageOfScript = false;
  };

  newPage(); // Start with the first page of the script content

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i+1];
    const elementType = determineElementType(line, nextLine);

    if (currentY < MARGIN_BOTTOM + LINE_HEIGHT) {
      newPage();
    }

    let xPos, maxWidthChars;
    let textToDraw = line.trimEnd(); // Keep leading spaces for AI-formatted indentation

    switch (elementType) {
      case ElementType.SCENE_HEADING:
        xPos = SCENE_HEADING_X_ABS;
        maxWidthChars = SCENE_HEADING_MAX_WIDTH_CHARS;
        textToDraw = line.trim().toUpperCase(); // Scene headings always uppercase and trimmed
        currentY -= LINE_HEIGHT; // Extra space before scene heading
        if (currentY < MARGIN_BOTTOM + LINE_HEIGHT) newPage();
        break;
      case ElementType.ACTION:
        xPos = ACTION_X_ABS;
        maxWidthChars = ACTION_MAX_WIDTH_CHARS;
        break;
      case ElementType.CHARACTER_NAME:
        xPos = CHARACTER_NAME_X_ABS;
        maxWidthChars = CHARACTER_NAME_MAX_WIDTH_CHARS;
        textToDraw = line.trim().toUpperCase();
        currentY -= LINE_HEIGHT; // Space before character name
        if (currentY < MARGIN_BOTTOM + LINE_HEIGHT) newPage();
        break;
      case ElementType.PARENTHETICAL:
        xPos = PARENTHETICAL_X_ABS;
        maxWidthChars = PARENTHETICAL_MAX_WIDTH_CHARS;
        break;
      case ElementType.DIALOGUE:
        xPos = DIALOGUE_X_ABS;
        maxWidthChars = DIALOGUE_MAX_WIDTH_CHARS;
        break;
      case ElementType.TRANSITION:
        xPos = TRANSITION_X_ABS;
        maxWidthChars = TRANSITION_MAX_WIDTH_CHARS;
        textToDraw = line.trim().toUpperCase();
        currentY -= LINE_HEIGHT;
        if (currentY < MARGIN_BOTTOM + LINE_HEIGHT) newPage();
        break;
      case ElementType.EMPTY_LINE:
        currentY -= LINE_HEIGHT;
        continue;
      default: // UNKNOWN
        xPos = ACTION_X_ABS;
        maxWidthChars = ACTION_MAX_WIDTH_CHARS;
        break;
    }

    // Handle wrapping (simplified)
    const words = textToDraw.split(' ');
    let currentLineText = '';
    for (const word of words) {
        const testLine = currentLineText + (currentLineText ? ' ' : '') + word;
        if (testLine.length > maxWidthChars && currentLineText) {
            if (currentY < MARGIN_BOTTOM + LINE_HEIGHT) newPage();
            currentPage.drawText(currentLineText, { x: xPos, y: currentY, font: courierFont, size: FONT_SIZE, color: rgb(0, 0, 0) });
            currentY -= LINE_HEIGHT;
            currentLineText = word;
        } else {
            currentLineText = testLine;
        }
    }
    if (currentLineText) {
        if (currentY < MARGIN_BOTTOM + LINE_HEIGHT) newPage();
        currentPage.drawText(currentLineText, { x: xPos, y: currentY, font: courierFont, size: FONT_SIZE, color: rgb(0, 0, 0) });
        currentY -= LINE_HEIGHT;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}