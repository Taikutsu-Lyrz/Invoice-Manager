import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface PaymentData {
    id: string;
    amount: number;
    method: string;
    paymentDate: string;
    reference?: string;
    isRefund: boolean;
    invoiceNumber: string;
    invoiceTotal: number;
    client: {
        name: string;
        email?: string;
        billingAddress: string;
    };
}

interface Settings {
    companyName: string;
    companyAddress: string;
    companyEmail: string;
    companyPhone: string;
    currency: string;
    currencySymbol: string;
    footerText?: string;
}

export async function generateReceiptPdf(
    payment: PaymentData,
    settings: Settings
): Promise<string> {
    const pdfDoc = await PDFDocument.create();

    const pageWidth = 400;
    const pageHeight = 550;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const primaryColor = rgb(0.08, 0.4, 0.94);
    const textColor = rgb(0.2, 0.2, 0.2);
    const lightGray = rgb(0.6, 0.6, 0.6);

    let yPosition = pageHeight - 40;
    const margin = 30;
    const contentWidth = pageWidth - margin * 2;

    // Header
    page.drawText(settings.companyName, {
        x: margin,
        y: yPosition,
        size: 16,
        font: fontBold,
        color: primaryColor,
    });

    yPosition -= 25;

    // Receipt title
    page.drawText(payment.isRefund ? 'REFUND RECEIPT' : 'PAYMENT RECEIPT', {
        x: margin,
        y: yPosition,
        size: 14,
        font: fontBold,
        color: textColor,
    });

    yPosition -= 20;

    // Receipt number (using payment ID)
    page.drawText(`Receipt #: ${payment.id.substring(0, 8).toUpperCase()}`, {
        x: margin,
        y: yPosition,
        size: 9,
        font: fontRegular,
        color: lightGray,
    });

    yPosition -= 12;
    page.drawText(`Date: ${formatDate(payment.paymentDate)}`, {
        x: margin,
        y: yPosition,
        size: 9,
        font: fontRegular,
        color: lightGray,
    });

    yPosition -= 30;

    // Divider
    page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: margin + contentWidth, y: yPosition },
        thickness: 1,
        color: rgb(0.9, 0.9, 0.9),
    });

    yPosition -= 20;

    // Client info
    page.drawText('RECEIVED FROM', {
        x: margin,
        y: yPosition,
        size: 8,
        font: fontBold,
        color: primaryColor,
    });

    yPosition -= 15;
    page.drawText(payment.client.name, {
        x: margin,
        y: yPosition,
        size: 11,
        font: fontBold,
        color: textColor,
    });

    yPosition -= 14;
    const addressLines = payment.client.billingAddress.split('\n');
    for (const line of addressLines.slice(0, 2)) {
        page.drawText(line, {
            x: margin,
            y: yPosition,
            size: 9,
            font: fontRegular,
            color: textColor,
        });
        yPosition -= 12;
    }

    yPosition -= 20;

    // Payment details box
    page.drawRectangle({
        x: margin,
        y: yPosition - 80,
        width: contentWidth,
        height: 90,
        color: rgb(0.97, 0.98, 1),
        borderColor: rgb(0.9, 0.9, 0.95),
        borderWidth: 1,
    });

    yPosition -= 15;

    // Invoice reference
    page.drawText('For Invoice:', {
        x: margin + 10,
        y: yPosition,
        size: 9,
        font: fontRegular,
        color: lightGray,
    });
    page.drawText(payment.invoiceNumber, {
        x: margin + 100,
        y: yPosition,
        size: 10,
        font: fontBold,
        color: textColor,
    });

    yPosition -= 16;

    // Payment method
    page.drawText('Method:', {
        x: margin + 10,
        y: yPosition,
        size: 9,
        font: fontRegular,
        color: lightGray,
    });
    page.drawText(capitalizeFirst(payment.method), {
        x: margin + 100,
        y: yPosition,
        size: 10,
        font: fontRegular,
        color: textColor,
    });

    yPosition -= 16;

    // Reference
    if (payment.reference) {
        page.drawText('Reference:', {
            x: margin + 10,
            y: yPosition,
            size: 9,
            font: fontRegular,
            color: lightGray,
        });
        page.drawText(payment.reference, {
            x: margin + 100,
            y: yPosition,
            size: 10,
            font: fontRegular,
            color: textColor,
        });
        yPosition -= 16;
    }

    // Amount
    page.drawText('Amount:', {
        x: margin + 10,
        y: yPosition,
        size: 9,
        font: fontRegular,
        color: lightGray,
    });
    page.drawText(formatCurrency(payment.amount, settings), {
        x: margin + 100,
        y: yPosition,
        size: 14,
        font: fontBold,
        color: payment.isRefund ? rgb(0.9, 0.2, 0.2) : primaryColor,
    });

    yPosition -= 50;

    // Thank you message
    page.drawText('Thank you for your payment!', {
        x: pageWidth / 2 - 70,
        y: yPosition,
        size: 10,
        font: fontRegular,
        color: lightGray,
    });

    yPosition -= 30;

    // Company footer
    page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: margin + contentWidth, y: yPosition },
        thickness: 0.5,
        color: rgb(0.9, 0.9, 0.9),
    });

    yPosition -= 15;

    const addressText = settings.companyAddress.replace(/\n/g, ' | ');
    page.drawText(addressText.substring(0, 60), {
        x: margin,
        y: yPosition,
        size: 7,
        font: fontRegular,
        color: lightGray,
    });

    yPosition -= 10;
    page.drawText(`${settings.companyEmail} | ${settings.companyPhone}`, {
        x: margin,
        y: yPosition,
        size: 7,
        font: fontRegular,
        color: lightGray,
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const outputDir = path.join(app.getPath('userData'), 'receipts');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `receipt-${payment.id.substring(0, 8)}.pdf`);
    fs.writeFileSync(outputPath, pdfBytes);

    return outputPath;
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatCurrency(amount: number, settings: Settings): string {
    return `${settings.currencySymbol}${amount.toFixed(2)}`;
}

function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
