import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, degrees } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface InvoiceData {
    id: string;
    invoiceNumber: string;
    status: string;
    issueDate: string;
    dueDate: string;
    subtotal: number;
    taxTotal: number;
    discountTotal: number;
    grandTotal: number;
    amountPaid: number;
    balanceDue: number;
    notes?: string;
    terms?: string;
    client: {
        name: string;
        email?: string;
        billingAddress: string;
        phone?: string;
        taxNumber?: string;
    };
    items: {
        description: string;
        quantity: number;
        unitPrice: number;
        taxRate: number;
        taxAmount: number;
        discountPercent: number;
        lineTotal: number;
    }[];
}

interface Settings {
    companyName: string;
    companyLogo?: string;
    companyAddress: string;
    companyEmail: string;
    companyPhone: string;
    taxId?: string;
    currency: string;
    currencySymbol: string;
    footerText?: string;
    pdfTemplate: 'classic' | 'modern';
    paperSize: 'a4' | 'letter';
}

export async function generateInvoicePdf(
    invoice: InvoiceData,
    settings: Settings,
    template: string = 'modern'
): Promise<string> {
    const pdfDoc = await PDFDocument.create();

    // Page dimensions
    const isA4 = settings.paperSize === 'a4';
    const pageWidth = isA4 ? 595.28 : 612;  // A4 or Letter width
    const pageHeight = isA4 ? 841.89 : 792; // A4 or Letter height

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Load fonts
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Colors
    const primaryColor = template === 'modern' ? rgb(0.08, 0.4, 0.94) : rgb(0.2, 0.2, 0.2);
    const textColor = rgb(0.2, 0.2, 0.2);
    const lightGray = rgb(0.6, 0.6, 0.6);
    const tableHeaderBg = template === 'modern' ? rgb(0.95, 0.97, 1) : rgb(0.9, 0.9, 0.9);

    let yPosition = pageHeight - 50;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    // Draw watermark if needed
    if (invoice.status === 'draft' || invoice.status === 'paid' || invoice.status === 'void') {
        const watermarkText = invoice.status.toUpperCase();
        const watermarkSize = 80;
        page.drawText(watermarkText, {
            x: pageWidth / 2 - (watermarkText.length * watermarkSize * 0.3),
            y: pageHeight / 2,
            size: watermarkSize,
            font: fontBold,
            color: rgb(0.9, 0.9, 0.9),
            rotate: degrees(-45),
        });
    }

    // Company header first
    page.drawText(settings.companyName, {
        x: margin,
        y: yPosition,
        size: 20,
        font: fontBold,
        color: primaryColor,
    });

    // Invoice label on the right
    page.drawText('INVOICE', {
        x: pageWidth - margin - 80,
        y: yPosition,
        size: 18,
        font: fontBold,
        color: primaryColor,
    });

    yPosition -= 25;

    // Logo offset for company info
    const logoMaxHeight = 40;
    let logoActualHeight = 0;

    // Try to embed company logo if available (under company name)
    if (settings.companyLogo && fs.existsSync(settings.companyLogo)) {
        try {
            const logoBytes = fs.readFileSync(settings.companyLogo);
            const logoExtension = path.extname(settings.companyLogo).toLowerCase();

            let logoImage;
            if (logoExtension === '.png') {
                logoImage = await pdfDoc.embedPng(logoBytes);
            } else if (logoExtension === '.jpg' || logoExtension === '.jpeg') {
                logoImage = await pdfDoc.embedJpg(logoBytes);
            }

            if (logoImage) {
                // Calculate logo dimensions maintaining aspect ratio
                const aspectRatio = logoImage.width / logoImage.height;
                let logoWidth = logoMaxHeight * aspectRatio;
                logoActualHeight = logoMaxHeight;

                // Limit max width
                if (logoWidth > 120) {
                    logoWidth = 120;
                    logoActualHeight = logoWidth / aspectRatio;
                }

                // Draw logo below company name
                page.drawImage(logoImage, {
                    x: margin,
                    y: yPosition - logoActualHeight,
                    width: logoWidth,
                    height: logoActualHeight,
                });

                // Add spacing after logo
                yPosition -= (logoActualHeight + 10);
            }
        } catch (error) {
            console.error('Failed to embed logo:', error);
        }
    }

    yPosition -= 5;

    // Company address
    const addressLines = (settings.companyAddress || '').split('\n');
    for (const line of addressLines) {
        page.drawText(line, {
            x: margin,
            y: yPosition,
            size: 9,
            font: fontRegular,
            color: textColor,
        });
        yPosition -= 12;
    }

    // Company contact
    page.drawText(settings.companyEmail, {
        x: margin,
        y: yPosition,
        size: 9,
        font: fontRegular,
        color: textColor,
    });
    yPosition -= 12;

    page.drawText(settings.companyPhone, {
        x: margin,
        y: yPosition,
        size: 9,
        font: fontRegular,
        color: textColor,
    });

    if (settings.taxId) {
        yPosition -= 12;
        page.drawText(`Tax ID: ${settings.taxId}`, {
            x: margin,
            y: yPosition,
            size: 9,
            font: fontRegular,
            color: textColor,
        });
    }

    // Invoice details on the right
    let rightY = pageHeight - 75;
    const rightX = pageWidth - margin - 150;

    const drawDetailRow = (label: string, value: string, bold: boolean = false) => {
        page.drawText(label, {
            x: rightX,
            y: rightY,
            size: 9,
            font: fontRegular,
            color: lightGray,
        });
        page.drawText(value, {
            x: rightX + 70,
            y: rightY,
            size: 9,
            font: bold ? fontBold : fontRegular,
            color: textColor,
        });
        rightY -= 14;
    };

    drawDetailRow('Invoice #:', invoice.invoiceNumber, true);
    drawDetailRow('Issue Date:', formatDate(invoice.issueDate));
    drawDetailRow('Due Date:', formatDate(invoice.dueDate));
    drawDetailRow('Status:', invoice.status.toUpperCase(), true);

    yPosition -= 40;

    // Bill To section
    page.drawText('BILL TO', {
        x: margin,
        y: yPosition,
        size: 10,
        font: fontBold,
        color: primaryColor,
    });
    yPosition -= 15;

    page.drawText(invoice.client.name, {
        x: margin,
        y: yPosition,
        size: 11,
        font: fontBold,
        color: textColor,
    });
    yPosition -= 14;

    const clientAddressLines = (invoice.client.billingAddress || '').split('\n');
    for (const line of clientAddressLines) {
        page.drawText(line, {
            x: margin,
            y: yPosition,
            size: 9,
            font: fontRegular,
            color: textColor,
        });
        yPosition -= 12;
    }

    if (invoice.client.email) {
        page.drawText(invoice.client.email, {
            x: margin,
            y: yPosition,
            size: 9,
            font: fontRegular,
            color: textColor,
        });
        yPosition -= 12;
    }

    if (invoice.client.phone) {
        page.drawText(invoice.client.phone, {
            x: margin,
            y: yPosition,
            size: 9,
            font: fontRegular,
            color: textColor,
        });
        yPosition -= 12;
    }

    if (invoice.client.taxNumber) {
        page.drawText(`Tax #: ${invoice.client.taxNumber}`, {
            x: margin,
            y: yPosition,
            size: 9,
            font: fontRegular,
            color: textColor,
        });
        yPosition -= 12;
    }

    yPosition -= 20;

    // Items table
    const tableTop = yPosition;
    const colWidths = [contentWidth * 0.4, contentWidth * 0.1, contentWidth * 0.15, contentWidth * 0.1, contentWidth * 0.1, contentWidth * 0.15];
    const colHeaders = ['Description', 'Qty', 'Unit Price', 'Tax', 'Disc', 'Total'];
    const colX = [margin];
    for (let i = 1; i < colWidths.length; i++) {
        colX.push(colX[i - 1] + colWidths[i - 1]);
    }

    // Table header background
    page.drawRectangle({
        x: margin,
        y: yPosition - 5,
        width: contentWidth,
        height: 20,
        color: tableHeaderBg,
    });

    // Table headers
    for (let i = 0; i < colHeaders.length; i++) {
        page.drawText(colHeaders[i], {
            x: colX[i] + 5,
            y: yPosition,
            size: 8,
            font: fontBold,
            color: textColor,
        });
    }

    yPosition -= 25;

    // Table rows
    for (const item of invoice.items) {
        // Check if we need a new page
        if (yPosition < 150) {
            // Add new page logic would go here
            // For simplicity, we'll just continue
        }

        const rowData = [
            truncateText(item.description, 45),
            item.quantity.toString(),
            formatCurrency(item.unitPrice, settings),
            `${item.taxRate}%`,
            item.discountPercent > 0 ? `${item.discountPercent}%` : '-',
            formatCurrency(item.lineTotal, settings),
        ];

        for (let i = 0; i < rowData.length; i++) {
            page.drawText(rowData[i], {
                x: colX[i] + 5,
                y: yPosition,
                size: 9,
                font: fontRegular,
                color: textColor,
            });
        }

        yPosition -= 18;

        // Row separator
        page.drawLine({
            start: { x: margin, y: yPosition + 8 },
            end: { x: margin + contentWidth, y: yPosition + 8 },
            thickness: 0.5,
            color: rgb(0.9, 0.9, 0.9),
        });
    }

    yPosition -= 20;

    // Totals section
    const totalsX = pageWidth - margin - 180;

    const drawTotalRow = (label: string, value: string, bold: boolean = false, large: boolean = false) => {
        page.drawText(label, {
            x: totalsX,
            y: yPosition,
            size: bold ? 10 : 9,
            font: bold ? fontBold : fontRegular,
            color: textColor,
        });
        page.drawText(value, {
            x: totalsX + 100,
            y: yPosition,
            size: large ? 12 : (bold ? 10 : 9),
            font: bold ? fontBold : fontRegular,
            color: bold ? primaryColor : textColor,
        });
        yPosition -= (large ? 20 : 16);
    };

    drawTotalRow('Subtotal:', formatCurrency(invoice.subtotal, settings));
    if (invoice.discountTotal > 0) {
        drawTotalRow('Discount:', `-${formatCurrency(invoice.discountTotal, settings)}`);
    }
    drawTotalRow('Tax:', formatCurrency(invoice.taxTotal, settings));

    // Separator line
    page.drawLine({
        start: { x: totalsX, y: yPosition + 10 },
        end: { x: totalsX + 180, y: yPosition + 10 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
    });

    yPosition -= 5;
    drawTotalRow('Grand Total:', formatCurrency(invoice.grandTotal, settings), true, true);

    if (invoice.amountPaid > 0) {
        drawTotalRow('Amount Paid:', formatCurrency(invoice.amountPaid, settings));
        drawTotalRow('Balance Due:', formatCurrency(invoice.balanceDue, settings), true);
    }

    // Notes and terms
    yPosition -= 30;

    if (invoice.notes) {
        page.drawText('Notes:', {
            x: margin,
            y: yPosition,
            size: 9,
            font: fontBold,
            color: textColor,
        });
        yPosition -= 14;

        const noteLines = wrapText(invoice.notes, 80);
        for (const line of noteLines.slice(0, 3)) {
            page.drawText(line, {
                x: margin,
                y: yPosition,
                size: 8,
                font: fontRegular,
                color: lightGray,
            });
            yPosition -= 12;
        }
    }

    if (invoice.terms) {
        yPosition -= 10;
        page.drawText('Terms & Conditions:', {
            x: margin,
            y: yPosition,
            size: 9,
            font: fontBold,
            color: textColor,
        });
        yPosition -= 14;

        const termLines = wrapText(invoice.terms, 80);
        for (const line of termLines.slice(0, 3)) {
            page.drawText(line, {
                x: margin,
                y: yPosition,
                size: 8,
                font: fontRegular,
                color: lightGray,
            });
            yPosition -= 12;
        }
    }

    // Footer
    if (settings.footerText) {
        page.drawText(settings.footerText, {
            x: margin,
            y: 30,
            size: 8,
            font: fontRegular,
            color: lightGray,
        });
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const outputDir = path.join(app.getPath('userData'), 'invoices');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `${invoice.invoiceNumber}.pdf`);
    fs.writeFileSync(outputPath, pdfBytes);

    return outputPath;
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(amount: number, settings: Settings): string {
    return `${settings.currencySymbol}${amount.toFixed(2)}`;
}

function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

function wrapText(text: string, maxChars: number): string[] {
    const words = (text || '').split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxChars) {
            currentLine = (currentLine + ' ' + word).trim();
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);

    return lines;
}
