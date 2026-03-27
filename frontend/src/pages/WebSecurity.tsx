import { useState, useEffect, useCallback } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import UserProfileCard from "@/components/UserProfileCard";
import { Loader2, Download, RefreshCw, ShieldAlert } from "lucide-react";
import api from "../api/axios";

interface WebScan {
  id: string;
  status: string;
  createdAt: string;
  vulnerabilities?: { target?: string, findings?: any[] };
}

const WebSecurity = () => {
  const [scans, setScans] = useState<WebScan[]>([]);
  const [targetUrl, setTargetUrl] = useState("");
  const [scanType, setScanType] = useState("Quick");
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);

  const fetchWebScans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/websecurity/scans');
      setScans(res.data.scans || []);
    } catch (error) {
      console.error("Failed to fetch web scans:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebScans();
  }, [fetchWebScans]);

  const startSecurityAudit = async () => {
    if (!targetUrl) return;
    setScanning(true);
    setLogs([`[JARVIS] Establishing secure connection for ${scanType} Audit...`]);

    try {
      const token = localStorage.getItem("ztg_token");
      const API_BASE = "http://localhost:5000";
      
      const response = await fetch(`${API_BASE}/api/websecurity/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ targetUrl, scanType })
      });

      if (!response.body) throw new Error("Server streaming not supported.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // keep incomplete line buffer
          
          lines.forEach(line => {
             const trimmed = line.trim();
             if (trimmed) {
                if (trimmed === "---FINISHED---") {
                   // Acknowledge Finish Command
                } else if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                   // JSON appended at end. Let's ignore displaying JSON block string.
                } else {
                   setLogs(prev => [...prev, trimmed]);
                }
             }
          });
        }
      }

      await fetchWebScans();
      setLogs(prev => [...prev, `[JARVIS] Audit reporting concluded natively. Table dynamically updated.`]);
    } catch (err: any) {
      setLogs(prev => [...prev, `[ERROR] ${err.message || "Failed to execute streaming scan."}`]);
      alert(err.message || "Failed to start scan");
    } finally {
      setScanning(false);
    }
  };

  const downloadAuditReport = async (id: string | number) => {
    try {
      const res = await api.get(`/api/websecurity/report/${id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Security_Audit_Report_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      alert("Failed to download report");
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-8 relative overflow-y-auto">
        <div className="absolute top-6 right-8 z-50">
          <UserProfileCard />
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Web Security</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Vulnerability scanning and threat assessment
            </p>
          </div>
          <button
            onClick={fetchWebScans}
            className="mr-14 px-4 py-2 rounded-md bg-secondary border border-border text-sm text-foreground hover:bg-secondary/80 transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="glass-card p-6 mb-6 flex flex-col gap-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary" /> Vulnerability Scanner
              </h3>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <select
                  value={scanType}
                  onChange={(e) => setScanType(e.target.value)}
                  className="px-4 py-2 rounded-md bg-secondary/50 border border-border text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="Quick">Quick Scan</option>
                  <option value="Stealth">Stealth Scan</option>
                  <option value="Vuln">Vulnerability Scan</option>
                  <option value="Full">Full Scan</option>
                </select>
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="Enter target URL (e.g., http://localhost:5000)"
                  className="flex-1 w-full px-4 py-2 rounded-md bg-secondary/50 border border-border text-foreground focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  onClick={startSecurityAudit}
                  disabled={scanning || !targetUrl}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 w-full md:w-auto whitespace-nowrap"
                >
                  {scanning && <Loader2 className="w-4 h-4 animate-spin" />}
                  Start Security Audit
                </button>
              </div>

              <div className="bg-black/90 text-green-400 font-mono text-xs p-4 rounded-md h-40 overflow-y-auto w-full border border-border shadow-inner mt-2">
                {logs.length === 0 ? (
                  <span className="opacity-50">System Idle. Awaiting commands...</span>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className={scanType === "Full" ? "text-cyan-400" : ""}>
                      {log.startsWith("[ALERT]") ? (
                        <span className="text-red-400">{log}</span>
                      ) : log.startsWith("[ERROR]") ? (
                        <span className="text-destructive font-bold">{log}</span>
                      ) : log.startsWith("[JARVIS]") ? (
                        <span className="text-primary font-bold">{log}</span>
                      ) : log.startsWith("[SYS]") ? (
                         <span className="text-muted-foreground">{log}</span>
                      ) : (
                        <span>{log}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="glass-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                    <tr>
                      <th className="px-6 py-4 font-medium">Target URL</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Timestamp</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {scans.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No scans found</td></tr>
                    ) : (
                      scans.map((scan) => (
                        <tr key={scan.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-6 py-4 font-medium">{scan.vulnerabilities?.target || "N/A"}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              scan.status === "COMPLETED" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
                            }`}>
                              {scan.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-muted-foreground">
                            {new Date(scan.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                               onClick={() => downloadAuditReport(scan.id)}
                               className="px-3 py-1.5 bg-secondary text-foreground hover:bg-primary/20 hover:text-primary rounded transition-colors inline-flex items-center gap-2 text-xs"
                               title="Download Audit Report"
                            >
                              <Download className="w-3 h-3" />
                              Download Audit Report
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default WebSecurity;
