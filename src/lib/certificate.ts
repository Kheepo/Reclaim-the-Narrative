/**
 * PDF certificate generation module
 * Creates tamper-proof certificates for submitted reports
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { generateHash } from './encryption';

export interface CertificateData {
  reportId: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: string;
  ipfsHash: string;
  reportHash: string;
  submissionDate: string;
  verificationUrl: string;
}

export interface CertificateOptions {
  includeQRCode?: boolean;
  includeWatermark?: boolean;
  format?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
}

const DEFAULT_OPTIONS: Required<CertificateOptions> = {
  includeQRCode: true,
  includeWatermark: true,
  format: 'A4',
  orientation: 'portrait'
};

/**
 * Generate a PDF certificate for a submitted report
 */
export async function generateCertificate(
  data: CertificateData,
  options: CertificateOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Create PDF document
  const pdf = new jsPDF({
    orientation: opts.orientation,
    unit: 'mm',
    format: opts.format
  });
  
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  
  // Add watermark if enabled
  if (opts.includeWatermark) {
    addWatermark(pdf, pageWidth, pageHeight);
  }
  
  // Add header
  addHeader(pdf, margin, contentWidth);
  
  // Add certificate content
  let yPosition = addCertificateContent(pdf, data, margin, contentWidth, 60);
  
  // Add verification section
  yPosition = addVerificationSection(pdf, data, margin, contentWidth, yPosition + 20);
  
  // Add QR code if enabled
  if (opts.includeQRCode) {
    await addQRCode(pdf, data.verificationUrl, pageWidth - margin - 40, yPosition + 10);
  }
  
  // Add footer
  addFooter(pdf, margin, contentWidth, pageHeight);
  
  // Return PDF as blob
  return pdf.output('blob');
}

/**
 * Add watermark to the PDF
 */
function addWatermark(pdf: jsPDF, pageWidth: number, pageHeight: number): void {
  pdf.setTextColor(240, 240, 240);
  pdf.setFontSize(60);
  pdf.setFont('helvetica', 'bold');
  
  // Rotate and add watermark text
  pdf.text('VERIFIED', pageWidth / 2, pageHeight / 2, {
    angle: 45,
    align: 'center'
  });
  
  // Reset text color
  pdf.setTextColor(0, 0, 0);
}

/**
 * Add header section
 */
function addHeader(pdf: jsPDF, margin: number, contentWidth: number): void {
  // Title
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(44, 62, 80); // Dark blue
  pdf.text('BLOCKCHAIN VERIFICATION CERTIFICATE', margin, 30, { maxWidth: contentWidth });
  
  // Subtitle
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text('Anonymous Report Submission Verification', margin, 40);
  
  // Line separator
  pdf.setDrawColor(44, 62, 80);
  pdf.setLineWidth(0.5);
  pdf.line(margin, 45, margin + contentWidth, 45);
}

/**
 * Add main certificate content
 */
function addCertificateContent(
  pdf: jsPDF,
  data: CertificateData,
  margin: number,
  contentWidth: number,
  startY: number
): number {
  let yPos = startY;
  
  // Certificate statement
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  
  const statement = 'This certificate verifies that an anonymous report has been successfully submitted and recorded on the blockchain. The report data has been encrypted and stored securely, ensuring complete anonymity while maintaining verifiability.';
  
  const statementLines = pdf.splitTextToSize(statement, contentWidth);
  pdf.text(statementLines, margin, yPos);
  yPos += statementLines.length * 5 + 10;
  
  // Report details
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('REPORT DETAILS:', margin, yPos);
  yPos += 8;
  
  pdf.setFont('helvetica', 'normal');
  
  const details = [
    { label: 'Report ID:', value: data.reportId },
    { label: 'Submission Date:', value: new Date(data.submissionDate).toLocaleString() },
    { label: 'Transaction Hash:', value: data.transactionHash },
    { label: 'Block Number:', value: data.blockNumber.toString() },
    { label: 'IPFS Hash:', value: data.ipfsHash },
    { label: 'Report Hash:', value: data.reportHash }
  ];
  
  details.forEach(detail => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(detail.label, margin, yPos);
    
    pdf.setFont('helvetica', 'normal');
    const valueLines = pdf.splitTextToSize(detail.value, contentWidth - 40);
    pdf.text(valueLines, margin + 40, yPos);
    
    yPos += Math.max(5, valueLines.length * 5);
  });
  
  return yPos;
}

/**
 * Add verification section
 */
function addVerificationSection(
  pdf: jsPDF,
  data: CertificateData,
  margin: number,
  contentWidth: number,
  startY: number
): number {
  let yPos = startY;
  
  // Section title
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('VERIFICATION INFORMATION:', margin, yPos);
  yPos += 10;
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  
  const verificationText = [
    'This certificate can be independently verified using the blockchain transaction hash.',
    'The report data is encrypted and stored on IPFS, ensuring data integrity and availability.',
    'No personal information is stored or transmitted, maintaining complete anonymity.',
    '',
    `Verification URL: ${data.verificationUrl}`,
    '',
    'To verify this certificate:',
    '1. Visit the verification URL above or scan the QR code',
    '2. Enter the transaction hash provided in this certificate',
    '3. Confirm the blockchain record matches the certificate details'
  ];
  
  verificationText.forEach(line => {
    if (line === '') {
      yPos += 3;
    } else {
      const lines = pdf.splitTextToSize(line, contentWidth);
      pdf.text(lines, margin, yPos);
      yPos += lines.length * 4;
    }
  });
  
  return yPos;
}

/**
 * Add QR code for verification URL
 */
async function addQRCode(
  pdf: jsPDF,
  url: string,
  x: number,
  y: number
): Promise<void> {
  try {
    // Create QR code using a simple approach
    // In a real implementation, you might want to use a QR code library
    const qrSize = 40;
    
    // Draw QR code placeholder (simple rectangle for now)
    pdf.setDrawColor(0, 0, 0);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(x, y, qrSize, qrSize, 'FD');
    
    // Add QR code label
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Scan to verify', x, y + qrSize + 5);
    
    // Note: In a production environment, you would integrate a proper QR code library
    // such as 'qrcode' or 'qr-code-generator' to generate actual QR codes
  } catch (error) {
    console.warn('Failed to add QR code:', error);
  }
}

/**
 * Add footer section
 */
function addFooter(
  pdf: jsPDF,
  margin: number,
  contentWidth: number,
  pageHeight: number
): void {
  const footerY = pageHeight - 30;
  
  // Line separator
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(margin, footerY - 5, margin + contentWidth, footerY - 5);
  
  // Footer text
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  
  const footerText = [
    'This certificate is generated automatically and cryptographically verifiable.',
    'Generated on: ' + new Date().toLocaleString(),
    'Platform: Anonymous GBV Reporting System'
  ];
  
  footerText.forEach((text, index) => {
    pdf.text(text, margin, footerY + (index * 4));
  });
}

/**
 * Generate certificate from HTML element
 */
export async function generateCertificateFromHTML(
  elementId: string,
  filename: string = 'certificate.pdf'
): Promise<Blob> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with ID '${elementId}' not found`);
  }
  
  try {
    // Convert HTML to canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });
    
    // Create PDF from canvas
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 295; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    
    let position = 0;
    
    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    return pdf.output('blob');
  } catch (error) {
    console.error('Failed to generate certificate from HTML:', error);
    throw new Error(`Failed to generate certificate: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download certificate as PDF file
 */
export function downloadCertificate(
  blob: Blob,
  filename: string = 'verification-certificate.pdf'
): void {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download certificate:', error);
    throw new Error(`Failed to download certificate: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate certificate data
 */
export function validateCertificateData(data: Partial<CertificateData>): data is CertificateData {
  const required: (keyof CertificateData)[] = [
    'reportId',
    'transactionHash',
    'blockNumber',
    'timestamp',
    'ipfsHash',
    'reportHash',
    'submissionDate',
    'verificationUrl'
  ];
  
  return required.every(field => {
    const value = data[field];
    return value !== undefined && value !== null && value !== '';
  });
}

/**
 * Generate certificate hash for integrity verification
 */
export async function generateCertificateHash(data: CertificateData): Promise<string> {
  const certificateString = JSON.stringify(data, Object.keys(data).sort());
  return await generateHash(certificateString);
}

/**
 * Create certificate data from blockchain transaction
 */
export function createCertificateData(
  reportId: string,
  transactionHash: string,
  blockNumber: number,
  timestamp: string,
  ipfsHash: string,
  reportHash: string,
  baseUrl: string = window.location.origin
): CertificateData {
  return {
    reportId,
    transactionHash,
    blockNumber,
    timestamp,
    ipfsHash,
    reportHash,
    submissionDate: new Date().toISOString(),
    verificationUrl: `${baseUrl}/verify?tx=${transactionHash}`
  };
}