declare module 'pdf-parse' {
  interface PdfData {
    /** The number of pages in the document */
    numpages: number;
    /** Total number of pages in the document */
    numrender: number;
    /** PDF info */
    info: any;
    /** PDF metadata */
    metadata: any;
    /** PDF.js version */
    version: string;
    /** The extracted text content */
    text: string;
  }

  /**
   * Parse PDF file
   * @param dataBuffer - PDF file buffer
   * @param options - Optional configurations
   * @returns A promise that resolves with parsed PDF data
   */
  function pdfParse(
    dataBuffer: Buffer,
    options?: {
      pagerender?: (pageData: any) => string;
      max?: number;
    }
  ): Promise<PdfData>;

  export default pdfParse;
}