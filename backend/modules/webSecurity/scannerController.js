const { spawn } = require("child_process");
const fs = require("fs");
const WebScan = require("../../models/WebScan");
const PDFDocument = require("pdfkit"); 

exports.runScan = async (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const scanType = req.body.scanType || "Quick";
    let target = req.body.targetUrl || "localhost";
    
    // strip http/https for nmap since nmap takes hostname/IP natively
    target = target.replace(/^https?:\/\//, '').replace(/\/$/, '');

    let args = [];
    if (scanType === "Stealth") {
        args = ["-sS", "-T2", target];
    } else if (scanType === "Vuln") {
        args = ["--script", "vuln", target];
    } else if (scanType === "Full") {
        args = ["-p-", "-sV", "-A", "-T4", target]; // -A provides OS + versions without needing strict -O
    } else { 
        args = ["-T4", "-F", target];
    }

    // Manual Path Check for Windows
    let nmapCommand = "nmap";
    const commonPaths = [
        "C:\\Program Files (x86)\\Nmap\\nmap.exe",
        "C:\\Program Files\\Nmap\\nmap.exe"
    ];
    
    for (const p of commonPaths) {
        if (fs.existsSync(p)) {
            // Must wrap in quotes for paths with spaces over shell
            nmapCommand = `"${p}"`;
            break;
        }
    }

    res.write(`[JARVIS] Initializing Nmap Engine for ${scanType} Audit...\n`);
    res.write(`[SCAN] Target acquired: ${target}\n`);
    res.write(`[SYS] Executing: ${nmapCommand} ${args.join(" ")}\n\n`);

    const nmapProcess = spawn(nmapCommand, args, { shell: true });
    let fullOutput = "";
    let handshaken = false;

    nmapProcess.stdout.on('data', (data) => {
        if (!handshaken) {
            res.write(`[JARVIS] Nmap Engine successfully linked. Handshaking with target...\n\n`);
            handshaken = true;
        }
        const text = data.toString();
        fullOutput += text;
        res.write(text); // stream raw nmap lines directly to frontend console
    });

    nmapProcess.stderr.on('data', (data) => {
        if (!handshaken) {
            res.write(`[JARVIS] Nmap Engine successfully linked. Handshaking with target...\n\n`);
            handshaken = true;
        }
        const text = data.toString();
        fullOutput += text;
        res.write(`[ERROR/NMAP] ${text}\n`);
    });

    nmapProcess.on('error', (err) => {
        res.write(`[ERROR] Failed to execute Nmap process: ${err.message} (${err.code})\n`);
        res.write(`[SYS] Engine failure. Ensure Nmap is installed locally.\n`);
        res.write(`---FINISHED---\n`);
        res.end(); 
    });

    nmapProcess.on('close', async (code) => {
        res.write(`\n\n[JARVIS] Nmap Scan terminated with exit code ${code}.\n`);
        res.write(`[SYS] Parsing results into Central Database...\n`);

        const findings = [];
        const lines = fullOutput.split('\n');
        
        lines.forEach(line => {
            // "80/tcp  open  http    nginx 1.18.0"
            const portMatch = line.match(/^(\d+)\/(tcp|udp)\s+open\s+(.*)/);
            if (portMatch) {
               findings.push({
                   severity: ["80", "443"].includes(portMatch[1]) ? "Info" : "Medium",
                   type: "Network Port",
                   endpoint: `Port ${portMatch[1]} (${portMatch[2]})`,
                   description: `Service identified: ${portMatch[3].trim()}`
               });
            }

            if (line.includes("VULNERABLE:") || line.includes("| _vulnerability") || line.toLowerCase().includes("vulnerable")) {
               findings.push({
                   severity: "High",
                   type: "Vulnerability Module Alert",
                   endpoint: target,
                   description: line.trim()
               });
            }
        });

        if (findings.length === 0) {
           findings.push({ severity: "Info", type: "Scan Complete", endpoint: target, description: "No explicit open ports or vulnerabilities mapped under current profile." });
        }

        const scanResults = {
            target: target,
            scanType: scanType,
            findings
        };

        try {
            const newScan = await WebScan.create({
                status: "COMPLETED",
                vulnerabilities: scanResults
            });
            res.write(`[JARVIS] Successfully saved configuration to Database (ID: ${newScan.id})\n`);
            
            res.write('---FINISHED---\n');
            res.write(JSON.stringify({ scanId: newScan.id, results: scanResults }) + "\n");
        } catch (err) {
            console.error(err);
            res.write(`[ERROR] Database save failed: ${err.message}\n`);
            res.write('---FINISHED---\n');
        }
        
        res.end();
    });
};

exports.generatePdfReport = async (req, res) => {
  try {
    const { id } = req.params;
    const scan = await WebScan.findByPk(id);

    if (!scan) {
      return res.status(404).json({ error: "Scan not found" });
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=ZeroTrustGuard_Audit_${id}.pdf`);
    doc.pipe(res);

    // 1. Watermark & Background Management
    const drawBackground = () => {
        doc.save(); // Isolate opacity to this scope
        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0f172a');
        
        doc.translate(doc.page.width / 2, doc.page.height / 2);
        doc.rotate(-45);
        doc.fillOpacity(0.05);
        doc.fillColor('#cbd5e1');
        doc.font('Helvetica-Bold').fontSize(80);
        const textStr = 'CONFIDENTIAL';
        doc.text(textStr, -doc.widthOfString(textStr) / 2, -doc.currentLineHeight() / 2, { lineBreak: false });
        doc.restore(); // Return to fully opaque bounds securely!
    };

    // Ensure watermark is drawn first on each page
    doc.on('pageAdded', drawBackground);
    drawBackground(); // Render on the initial page

    // Table Header Logic
    const drawTableHeaders = () => {
        const currentY = doc.y;
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#cbd5e1');
        doc.text('Port', 50, currentY, { width: 80 });
        doc.text('State', 150, currentY, { width: 80 });
        doc.text('Service', 250, currentY);
        doc.moveDown(0.5);
        doc.rect(50, doc.y, 450, 1).fill('#334155');
        doc.y += 10;
    };

    // 2. Table Row Pagination (checkPageBreak)
    const checkPageBreak = (threshold = 720) => {
        if (doc.y > threshold) {
            doc.addPage();
            drawTableHeaders(); 
        }
    };

    const drawSlice = (cx, cy, radius, startAngle, endAngle, color) => {
        if (endAngle <= startAngle) return;
        if (endAngle - startAngle >= Math.PI * 1.99) {
            doc.circle(cx, cy, radius).fill(color);
            return;
        }
        const x1 = cx + radius * Math.cos(startAngle);
        const y1 = cy + radius * Math.sin(startAngle);
        const x2 = cx + radius * Math.cos(endAngle);
        const y2 = cy + radius * Math.sin(endAngle);
        const largeArc = (endAngle - startAngle > Math.PI) ? 1 : 0;
        doc.path(`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`).fill(color);
    };

    // Document Metadata Pre-Processing
    const vulns = scan.vulnerabilities || {};
    const scanProfile = vulns.scanType || "Stealth Scan";
    const findings = vulns.findings || [];
    const portFindings = findings.filter(f => f.type === "Network Port");
    const otherFindings = findings.filter(f => f.type !== "Network Port");

    // Critical Ports Parsing
    let criticalPortCount = 0;
    portFindings.forEach(pf => {
        const pMatch = pf.endpoint.match(/\d+/);
        if (pMatch && [21, 22, 23, 3306, 5432, 1433, 27017].includes(parseInt(pMatch[0]))) {
            criticalPortCount++;
        }
    });

    // Header Rendering
    doc.fillColor('#f8fafc');
    doc.font('Helvetica-Bold').fontSize(26).text("ZeroTrustGuard", 50, 50, { align: "center" });
    doc.font('Helvetica').fillColor('#94a3b8').fontSize(14).text("Enterprise Security Audit Report", { align: "center" });
    doc.moveDown(1.5);
    
    // Dynamic Risk Badge (Secure doc.y logic)
    const riskBadgeColor = criticalPortCount > 10 ? '#ef4444' : (criticalPortCount > 0 ? '#f97316' : '#10b981');
    const riskBadgeText = criticalPortCount > 10 ? 'HIGH RISK' : (criticalPortCount > 0 ? 'ELEVATED RISK' : 'SECURE');
    
    const badgeY = doc.y;
    doc.rect(doc.page.width / 2 - 60, badgeY, 120, 20).fill(riskBadgeColor);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text(riskBadgeText, doc.page.width / 2 - 60, badgeY + 6, { width: 120, align: 'center' });
    doc.y = badgeY + 40; // Explicit shift down securely

    // Scan Metadata
    const metadataY = doc.y;
    doc.fillColor('#f8fafc').font('Helvetica-Bold').fontSize(14).text("Scan Metadata", 50, metadataY);
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11).fillColor('#cbd5e1');
    doc.text(`Scan ID: ${scan.id}`);
    doc.text(`Scan Profile: ${scanProfile}`);
    doc.text(`Target: ${vulns.target || "Unknown"}`);
    const scanDate = new Date(scan.createdAt || scan.scanDate).toLocaleString();
    doc.text(`Completed: ${scanDate}`);
    const metaBottomY = doc.y;
    
    // Draw Risk Pie Chart natively floating in top right corners!
    const cx = doc.page.width - 120;
    const cy = metadataY + 40;
    const r = 35;
    const openCount = portFindings.length;
    
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#f8fafc').text("Crit/High vs Low/Info", cx - 55, cy - 50, { width: 110, align: 'center' });
    if (openCount === 0) {
        drawSlice(cx, cy, r, 0, Math.PI * 2, '#22c55e'); // Full Green (Low/Info)
    } else {
        const criticalAngle = (criticalPortCount / openCount) * Math.PI * 2;
        drawSlice(cx, cy, r, 0, criticalAngle, '#ef4444'); // Red criticals
        drawSlice(cx, cy, r, criticalAngle, Math.PI * 2, '#22c55e'); // Green standard
    }

    // Align layout cleanly under whichever is longest natively
    doc.y = Math.max(metaBottomY, cy + r + 10) + 20;

    // Port Density Bar (Background Track + Foreground Gradient)
    doc.fillColor('#f8fafc').font('Helvetica-Bold').fontSize(14).text("Attack Surface Density", 50, doc.y);
    doc.moveDown(0.5);
    
    // Background Track
    const densityY = doc.y;
    doc.lineJoin('round').rect(50, densityY, 400, 12).fill('#334155');
    
    // Foreground Fill Segment
    if (openCount > 0) {
        const fillRatio = Math.min(openCount / 20, 1); // Fills completely at 20+ ports
        const densityGrad = doc.linearGradient(50, densityY, 450, densityY);
        densityGrad.stop(0, '#22c55e').stop(1, '#ef4444');
        doc.lineJoin('round').rect(50, densityY, 400 * fillRatio, 12).fill(densityGrad);
    }
    
    doc.y = densityY + 20;
    doc.fillColor('#cbd5e1').font('Helvetica').fontSize(10).text(`Total Open Ports: ${openCount}`, 50, doc.y);
    doc.moveDown(2);

    // Nmap Results Summary Table
    if (portFindings.length > 0) {
        // Ensure we have enough space before the table header
        checkPageBreak(700);
        doc.fillColor('#f8fafc').font('Helvetica-Bold').fontSize(14).text('Nmap Results Summary', 50, doc.y);
        doc.moveDown(0.5);
        drawTableHeaders();
        
        doc.font('Helvetica').fontSize(10);
        portFindings.forEach((pf) => {
            // Pagination before each row
            checkPageBreak(720);
            
            const pMatch = pf.endpoint.match(/\d+/);
            const pNum = pMatch ? parseInt(pMatch[0]) : 0;
            const isCritical = [21, 23, 3306].includes(pNum);
            
            doc.fillColor(isCritical ? '#ef4444' : '#f8fafc');
            const currentY = doc.y;
            doc.text(pNum.toString(), 50, currentY, { width: 80, lineBreak: false });
            doc.text('open', 150, currentY, { width: 80, lineBreak: false });
            let serviceSummary = pf.description.replace("Service identified: ", "").trim();
            doc.text(serviceSummary, 250, currentY, { width: 280, height: 12, ellipsis: true });
            
            doc.y = currentY + 15;
        });
        doc.moveDown(2);
    }

    if (doc.y > 600) doc.addPage();

    // Consolidate AI Insights (2-column list) wrap-safe
    if (portFindings.length > 0) {
        doc.fillColor('#60a5fa').font('Helvetica-Bold').fontSize(14).text('AI Threat Analysis (JARVIS Insights)', 50, doc.y);
        doc.moveDown(0.5);
        
        const insights = portFindings.map(pf => {
            const pMatch = pf.endpoint.match(/\d+/);
            const pNum = pMatch ? parseInt(pMatch[0]) : 0;
            let insight = `Verify exposure via WAF/Firewall.`;
            switch (pNum) {
                case 80:
                case 443: insight = "Implement a Web Application Firewall (WAF) to filter SQLi and XSS payloads."; break;
                case 5000:
                case 8080:
                case 8081: insight = "These are common dev-tunnel or application ports. Ensure they are not exposing raw environment variables or administrative debug logs."; break;
                case 3306:
                case 5432: insight = "Database exposure detected. Enforce strict IP-white-listing and disable remote root login."; break;
                case 21: insight = "FTP is plaintext. Use SFTP."; break;
                case 22: insight = "Ensure key-based auth prevents dictionary attacks."; break;
                case 23: insight = "Telnet is unsecure. Migrate to SSH."; break;
            }
            return { port: pNum, text: insight };
        });

        const colWidth = 220;
        const leftColX = 50;
        const rightColX = 290;
        let isLeft = true;
        let columnStartY = doc.y;
        let maxRowHeight = 0;

        insights.forEach((item, index) => {
            doc.font('Helvetica-Bold').fontSize(9);
            const textStr = `[JARVIS] Port ${item.port}: ${item.text}`;
            const height = doc.heightOfString(textStr, { width: colWidth });

            if (columnStartY + height > 740 && isLeft) {
                doc.addPage();
                columnStartY = doc.y;
            }

            maxRowHeight = Math.max(maxRowHeight, height);
            const currentX = isLeft ? leftColX : rightColX;

            doc.fillColor('#fbbf24').font('Helvetica-Bold').text(`[JARVIS] Port ${item.port}: `, currentX, columnStartY, { width: colWidth, continued: true })
               .fillColor('#cbd5e1').font('Helvetica').text(item.text, { width: colWidth });

            if (isLeft) {
                isLeft = false; 
            } else {
                isLeft = true; 
                columnStartY += maxRowHeight + 10; 
                maxRowHeight = 0;
            }
        });
        
        doc.y = isLeft ? columnStartY : columnStartY + maxRowHeight + 10;
        doc.moveDown();
    }

    // Vulnerabilities
    if (otherFindings.length > 0) {
        if (doc.y > 600) doc.addPage();
        doc.fillColor('#f8fafc').font('Helvetica-Bold').fontSize(14).text('Vulnerability Discoveries', 50, doc.y);
        doc.moveDown(0.5);
        
        otherFindings.forEach((finding, index) => {
            if (doc.y > 720) doc.addPage();
            
            let color = '#38bdf8'; 
            if (finding.severity === "High" || finding.severity === "Critical") color = '#ef4444';
            else if (finding.severity === "Medium") color = '#f97316';

            const currentY = doc.y;
            doc.fillColor(color).font('Helvetica-Bold').fontSize(11).text(`${index + 1}. [${finding.severity}] ${finding.type}`, 50, currentY);
            doc.fillColor('#cbd5e1').font('Helvetica').fontSize(10).text(`Endpoint: ${finding.endpoint}`, 50, doc.y);
            doc.text(`Details: ${finding.description}`, 50, doc.y);
            doc.moveDown(1);
        });
    }

    doc.end();

  } catch (error) {
    console.error("PDF Generate Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate dynamic enterprise report" });
    }
  }
};

exports.getScans = async (req, res) => {
  try {
    const scans = await WebScan.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json({ scans });
  } catch (error) {
    console.error("Fetch Scans Error:", error);
    res.status(500).json({ error: "Failed to fetch scans" });
  }
};
