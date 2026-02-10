import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface ReportData {
    title: string;
    dateRange: { start: string; end: string };
    summary: {
        totalRevenue: number;
        totalExpenses: number;
        netProfit: number;
        invoiceCount: number;
        paidInvoices: number;
        unpaidInvoices: number;
    };
    topClients: Array<{ name: string; total: number }>;
    recentInvoices: Array<{
        invoiceNumber: string;
        clientName: string;
        amount: number;
        status: string;
        date: string;
    }>;
    monthlyData?: Array<{ month: string; revenue: number; expenses: number }>;
}

interface Settings {
    companyName: string;
    companyLogo?: string;
    companyAddress: string;
    currencySymbol: string;
}

export async function generateReportPdf(
    report: ReportData,
    settings: Settings
): Promise<string> {
    const pdfDoc = await PDFDocument.create();

    // Page dimensions (A4)
    const pageWidth = 595.28;
    const pageHeight = 841.89;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Load fonts
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Colors
    const primaryColor = rgb(0.08, 0.4, 0.94);
    const textColor = rgb(0.2, 0.2, 0.2);
    const lightGray = rgb(0.6, 0.6, 0.6);
    const greenColor = rgb(0.1, 0.6, 0.3);
    const redColor = rgb(0.8, 0.2, 0.2);

    let yPosition = pageHeight - 50;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    // Header
    page.drawText(settings.companyName, {
        x: margin,
        y: yPosition,
        size: 18,
        font: fontBold,
        color: primaryColor,
    });

    yPosition -= 25;

    // Try to embed company logo if available
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
                const aspectRatio = logoImage.width / logoImage.height;
                const logoHeight = 35;
                let logoWidth = logoHeight * aspectRatio;
                if (logoWidth > 100) logoWidth = 100;

                page.drawImage(logoImage, {
                    x: margin,
                    y: yPosition - logoHeight,
                    width: logoWidth,
                    height: logoHeight,
                });

                yPosition -= (logoHeight + 15);
            }
        } catch (error) {
            console.error('Failed to embed logo:', error);
        }
    }

    // Report title
    page.drawText(report.title, {
        x: margin,
        y: yPosition,
        size: 16,
        font: fontBold,
        color: textColor,
    });

    yPosition -= 20;

    // Date range
    page.drawText(`Period: ${report.dateRange.start} - ${report.dateRange.end}`, {
        x: margin,
        y: yPosition,
        size: 10,
        font: fontRegular,
        color: lightGray,
    });

    yPosition -= 35;

    // Summary Cards Section
    page.drawText('Financial Summary', {
        x: margin,
        y: yPosition,
        size: 12,
        font: fontBold,
        color: textColor,
    });

    yPosition -= 25;

    const cardWidth = (contentWidth - 20) / 3;
    const cardHeight = 60;

    // Total Revenue Card
    page.drawRectangle({
        x: margin,
        y: yPosition - cardHeight,
        width: cardWidth,
        height: cardHeight,
        color: rgb(0.95, 0.97, 1),
    });
    page.drawText('Total Revenue', {
        x: margin + 10,
        y: yPosition - 20,
        size: 9,
        font: fontRegular,
        color: lightGray,
    });
    page.drawText(`${settings.currencySymbol}${report.summary.totalRevenue.toFixed(2)}`, {
        x: margin + 10,
        y: yPosition - 40,
        size: 14,
        font: fontBold,
        color: greenColor,
    });

    // Total Expenses Card
    page.drawRectangle({
        x: margin + cardWidth + 10,
        y: yPosition - cardHeight,
        width: cardWidth,
        height: cardHeight,
        color: rgb(1, 0.95, 0.95),
    });
    page.drawText('Total Expenses', {
        x: margin + cardWidth + 20,
        y: yPosition - 20,
        size: 9,
        font: fontRegular,
        color: lightGray,
    });
    page.drawText(`${settings.currencySymbol}${report.summary.totalExpenses.toFixed(2)}`, {
        x: margin + cardWidth + 20,
        y: yPosition - 40,
        size: 14,
        font: fontBold,
        color: redColor,
    });

    // Net Profit Card
    const profitColor = report.summary.netProfit >= 0 ? greenColor : redColor;
    page.drawRectangle({
        x: margin + (cardWidth + 10) * 2,
        y: yPosition - cardHeight,
        width: cardWidth,
        height: cardHeight,
        color: rgb(0.95, 1, 0.95),
    });
    page.drawText('Net Profit', {
        x: margin + (cardWidth + 10) * 2 + 10,
        y: yPosition - 20,
        size: 9,
        font: fontRegular,
        color: lightGray,
    });
    page.drawText(`${settings.currencySymbol}${report.summary.netProfit.toFixed(2)}`, {
        x: margin + (cardWidth + 10) * 2 + 10,
        y: yPosition - 40,
        size: 14,
        font: fontBold,
        color: profitColor,
    });

    yPosition -= (cardHeight + 30);

    // Invoice Statistics
    page.drawText('Invoice Statistics', {
        x: margin,
        y: yPosition,
        size: 12,
        font: fontBold,
        color: textColor,
    });

    yPosition -= 20;

    const stats = [
        { label: 'Total Invoices', value: report.summary.invoiceCount.toString() },
        { label: 'Paid Invoices', value: report.summary.paidInvoices.toString() },
        { label: 'Unpaid Invoices', value: report.summary.unpaidInvoices.toString() },
    ];

    stats.forEach((stat, index) => {
        page.drawText(`${stat.label}:`, {
            x: margin,
            y: yPosition,
            size: 10,
            font: fontRegular,
            color: lightGray,
        });
        page.drawText(stat.value, {
            x: margin + 100,
            y: yPosition,
            size: 10,
            font: fontBold,
            color: textColor,
        });
        if (index < stats.length - 1) yPosition -= 15;
    });

    yPosition -= 35;

    // Top Clients Section
    if (report.topClients && report.topClients.length > 0) {
        page.drawText('Top Clients', {
            x: margin,
            y: yPosition,
            size: 12,
            font: fontBold,
            color: textColor,
        });

        yPosition -= 20;

        // Table header
        page.drawRectangle({
            x: margin,
            y: yPosition - 15,
            width: contentWidth,
            height: 20,
            color: rgb(0.95, 0.95, 0.95),
        });

        page.drawText('Client Name', {
            x: margin + 10,
            y: yPosition - 10,
            size: 9,
            font: fontBold,
            color: textColor,
        });

        page.drawText('Total Revenue', {
            x: pageWidth - margin - 100,
            y: yPosition - 10,
            size: 9,
            font: fontBold,
            color: textColor,
        });

        yPosition -= 20;

        report.topClients.slice(0, 5).forEach((client) => {
            yPosition -= 20;

            page.drawText(client.name || 'Unknown', {
                x: margin + 10,
                y: yPosition,
                size: 9,
                font: fontRegular,
                color: textColor,
            });

            page.drawText(`${settings.currencySymbol}${client.total.toFixed(2)}`, {
                x: pageWidth - margin - 100,
                y: yPosition,
                size: 9,
                font: fontBold,
                color: greenColor,
            });
        });

        yPosition -= 25;
    }

    // Recent Invoices Section
    if (report.recentInvoices && report.recentInvoices.length > 0) {
        page.drawText('Recent Invoices', {
            x: margin,
            y: yPosition,
            size: 12,
            font: fontBold,
            color: textColor,
        });

        yPosition -= 20;

        // Table header
        page.drawRectangle({
            x: margin,
            y: yPosition - 15,
            width: contentWidth,
            height: 20,
            color: rgb(0.95, 0.95, 0.95),
        });

        const cols = [
            { label: 'Invoice #', x: margin + 5 },
            { label: 'Client', x: margin + 80 },
            { label: 'Date', x: margin + 200 },
            { label: 'Amount', x: margin + 300 },
            { label: 'Status', x: margin + 400 },
        ];

        cols.forEach(col => {
            page.drawText(col.label, {
                x: col.x,
                y: yPosition - 10,
                size: 8,
                font: fontBold,
                color: textColor,
            });
        });

        yPosition -= 20;

        report.recentInvoices.slice(0, 10).forEach((invoice) => {
            yPosition -= 18;

            page.drawText(invoice.invoiceNumber, { x: margin + 5, y: yPosition, size: 8, font: fontRegular, color: primaryColor });
            page.drawText((invoice.clientName || 'N/A').substring(0, 20), { x: margin + 80, y: yPosition, size: 8, font: fontRegular, color: textColor });
            page.drawText(invoice.date, { x: margin + 200, y: yPosition, size: 8, font: fontRegular, color: textColor });
            page.drawText(`${settings.currencySymbol}${invoice.amount.toFixed(2)}`, { x: margin + 300, y: yPosition, size: 8, font: fontBold, color: textColor });

            const statusColor = invoice.status === 'paid' ? greenColor :
                invoice.status === 'overdue' ? redColor : lightGray;
            page.drawText(invoice.status.toUpperCase(), { x: margin + 400, y: yPosition, size: 8, font: fontBold, color: statusColor });
        });
    }

    // Footer
    const footerY = 30;
    page.drawText(`Generated on ${new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })}`, {
        x: margin,
        y: footerY,
        size: 8,
        font: fontRegular,
        color: lightGray,
    });

    page.drawText('Page 1', {
        x: pageWidth - margin - 30,
        y: footerY,
        size: 8,
        font: fontRegular,
        color: lightGray,
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const reportsDir = path.join(app.getPath('userData'), 'reports');

    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    const fileName = `report_${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, fileName);
    fs.writeFileSync(filePath, pdfBytes);

    return filePath;
}
