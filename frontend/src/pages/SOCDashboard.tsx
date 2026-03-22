import { useState, useEffect, useCallback } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import UserProfileCard from "@/components/UserProfileCard"; // Added Import
import { PinModal } from "@/components/PinModal";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  ShieldAlert,
  FileText,
  Trash2,
  Download,
} from "lucide-react";

import api from "../api/axios";
import { socApi } from "@/lib/api";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ... Alert and Log interfaces ...
interface Alert {
  id: string;
  riskScore: number;
  status: string;
  action: string;
  department: string | null;
  createdAt: string;
  User?: {
    email: string;
    department: string;
  };
}

interface Log {
  id: string;
  userId: string;
  action: string;
  resource: string;
  department: string | null;
  grantedBy: string | null;
  createdAt: string;
  User?: {
    email: string;
    name: string;
  };
}

interface SocFile {
  id: number;
  filename: string;
  department: string;
  createdAt: string;
  User: {
    name: string;
    email: string;
    role: string;
  };
}

interface DashboardStats {
  totalUsers: number;
  totalFiles: number;
  totalRequests: number;
  totalAlerts: number;
}

const SOCDashboard = () => {
  // ... existing state and fetchData logic ...
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [files, setFiles] = useState<SocFile[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalFiles: 0,
    totalRequests: 0,
    totalAlerts: 0
  });

  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"alerts" | "logs" | "files">("alerts");

  // PIN Modal State
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [fileToDownload, setFileToDownload] = useState<{id: number, filename: string} | null>(null);
  const [downloadPinError, setDownloadPinError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [alertsResult, logsResult, filesResult, statsResult] = await Promise.allSettled([
        socApi.getAlerts(),
        socApi.getLogs(),
        socApi.getSocFiles(),
        socApi.getDashboardStats()
      ]);

      if (alertsResult.status === 'fulfilled') {
        setAlerts(alertsResult.value.data.alerts || alertsResult.value.data || []);
      }
      if (logsResult.status === 'fulfilled') {
        setLogs(logsResult.value.data.logs || logsResult.value.data || []);
      }
      if (filesResult.status === 'fulfilled') {
        setFiles(filesResult.value.data.files || []);
      }
      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value.data);
      }
    } catch (error) {
      console.error("Failed to fetch SOC Dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resolveAlert = async (id: string) => {
    setResolvingId(id);
    try {
      await socApi.updateAlert(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "RESOLVED" } : a))
      );
    } catch { /* silent */ } 
    finally { setResolvingId(null); }
  };

  const handleDownload = (id: number, filename: string) => {
    setFileToDownload({ id, filename });
    setDownloadPinError("");
    setPinModalOpen(true);
  };

  const processDownload = async (pin: string) => {
    if (!fileToDownload) return;
    try {
      const res = await api.get(`/api/files/download/${fileToDownload.id}`, {
        responseType: "blob",
        headers: { "x-mfa-pin": pin }
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = fileToDownload.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      setPinModalOpen(false);
      setFileToDownload(null);
    } catch (err: any) {
      if (err.response && err.response.data instanceof Blob) {
        const text = await err.response.data.text();
        try {
            const data = JSON.parse(text);
            if (data.mfaRequired) {
                setDownloadPinError(data.message || "Invalid PIN");
                return;
            }
            alert(data.message || "Download failed.");
        } catch {
            alert("Download failed.");
        }
      } else {
        alert(err.response?.data?.message || "Network error during download.");
      }
      setPinModalOpen(false);
    }
  };

  // Stats and Data processing logic stays exactly as you provided
  const totalAlerts = alerts.length;
  const openAlerts = alerts.filter((a) => a.status !== "RESOLVED").length;
  const resolvedAlerts = alerts.filter((a) => a.status === "RESOLVED").length;

  const statusCounts: Record<string, number> = {};
  alerts.forEach((a) => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  const riskBuckets = [
    { range: "0-20", count: 0 }, { range: "21-40", count: 0 },
    { range: "41-60", count: 0 }, { range: "61-80", count: 0 },
    { range: "81-100", count: 0 },
  ];
  alerts.forEach((a) => {
    if (typeof a.riskScore === "number") {
      const idx = Math.min(Math.floor(a.riskScore / 20), 4);
      if (riskBuckets[idx]) riskBuckets[idx].count++;
    }
  });

  const PIE_COLORS = ["hsl(210, 100%, 56%)", "hsl(142, 71%, 45%)", "hsl(45, 93%, 47%)", "hsl(0, 72%, 51%)", "hsl(190, 95%, 50%)"];

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      {/* Added 'relative' to main to anchor the UserProfileCard */}
      <main className="flex-1 p-8 relative overflow-y-auto">
        <PinModal
          isOpen={pinModalOpen}
          onClose={() => setPinModalOpen(false)}
          onSubmit={processDownload}
          error={downloadPinError}
          title="Download Secured File"
          description={`Enter PIN to download ${fileToDownload?.filename}`}
        />
        
        {/* User Profile Card Pinned to Top Right */}
        <div className="absolute top-6 right-8 z-50">
          <UserProfileCard />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">SOC Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Security Operations Center — Real-time threat monitoring
            </p>
          </div>
          {/* Refresh button pushed slightly left of the Profile Card */}
          <button
            onClick={fetchData}
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
            {/* Stat Cards, Charts, and Tables remain exactly as your original code */}
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
               <div className="stat-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Users</p>
                    <p className="text-3xl font-bold font-mono text-foreground mt-1">{stats.totalUsers}</p>
                  </div>
                  <Activity className="w-8 h-8 text-primary opacity-50" />
                </div>
              </div>
              <div className="stat-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Files</p>
                    <p className="text-3xl font-bold font-mono text-success mt-1">{stats.totalFiles}</p>
                  </div>
                  <FileText className="w-8 h-8 text-success opacity-50" />
                </div>
              </div>
              <div className="stat-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Access Requests</p>
                    <p className="text-3xl font-bold font-mono text-warning mt-1">{stats.totalRequests}</p>
                  </div>
                  <Clock className="w-8 h-8 text-warning opacity-50" />
                </div>
              </div>
              <div className="stat-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">High Risk Alerts</p>
                    <p className="text-3xl font-bold font-mono text-destructive mt-1">{stats.totalAlerts}</p>
                  </div>
                  <ShieldAlert className="w-8 h-8 text-destructive opacity-50" />
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
               {/* ... Pie and Bar Charts ... */}
               <div className="glass-card p-6">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Dashboard Overview</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={[
                    { name: 'Total Users', count: stats.totalUsers },
                    { name: 'Total Files', count: stats.totalFiles },
                    { name: 'Total Requests', count: stats.totalRequests },
                    { name: 'Total Alerts', count: stats.totalAlerts }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} axisLine={{ stroke: "hsl(222, 30%, 16%)" }} />
                    <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} axisLine={{ stroke: "hsl(222, 30%, 16%)" }} />
                    <Tooltip contentStyle={{ background: "hsl(222, 47%, 9%)", border: "1px solid hsl(222, 30%, 16%)", borderRadius: "6px", color: "hsl(210, 40%, 92%)", fontSize: "12px" }} />
                    <Bar dataKey="count" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card p-6">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Alert Status Distribution</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(222, 47%, 9%)", border: "1px solid hsl(222, 30%, 16%)", borderRadius: "6px", color: "hsl(210, 40%, 92%)", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card p-6">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Risk Score Distribution</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={riskBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
                    <XAxis dataKey="range" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} axisLine={{ stroke: "hsl(222, 30%, 16%)" }} />
                    <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} axisLine={{ stroke: "hsl(222, 30%, 16%)" }} />
                    <Tooltip contentStyle={{ background: "hsl(222, 47%, 9%)", border: "1px solid hsl(222, 30%, 16%)", borderRadius: "6px", color: "hsl(210, 40%, 92%)", fontSize: "12px" }} />
                    <Bar dataKey="count" fill="hsl(210, 100%, 56%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border mb-6">
              <button
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "alerts"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
                onClick={() => setActiveTab("alerts")}
              >
                Security Alerts
              </button>
              <button
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "logs"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
                onClick={() => setActiveTab("logs")}
              >
                Activity Logs
              </button>
              <button
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "files"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
                onClick={() => setActiveTab("files")}
              >
                Uploaded Files
              </button>
            </div>

            {/* Tables Section */}
            <div className="glass-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                    {activeTab === "alerts" && (
                      <tr>
                        <th className="px-6 py-4 font-medium">Alert ID</th>
                        <th className="px-6 py-4 font-medium">User Email</th>
                        <th className="px-6 py-4 font-medium">Department</th>
                        <th className="px-6 py-4 font-medium">Action</th>
                        <th className="px-6 py-4 font-medium">Risk Score</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium">Created</th>
                        {/* <th className="px-6 py-4 font-medium text-right">Actions</th> */}
                      </tr>
                    )}
                    {activeTab === "logs" && (
                      <tr>
                        <th className="px-6 py-4 font-medium">Timestamp</th>
                        <th className="px-6 py-4 font-medium">User ID</th>
                        <th className="px-6 py-4 font-medium">User Email</th>
                        {/* <th className="px-6 py-4 font-medium">User Name</th> */}
                        <th className="px-6 py-4 font-medium">Department</th>
                        <th className="px-6 py-4 font-medium">Action</th>
                        <th className="px-6 py-4 font-medium">Resource</th>
                        {/* <th className="px-6 py-4 font-medium">Granted By</th> */}
                      </tr>
                    )}
                    {activeTab === "files" && (
                      <tr>
                        <th className="px-6 py-4 font-medium">File Name</th>
                        <th className="px-6 py-4 font-medium">Department</th>
                        <th className="px-6 py-4 font-medium">Uploaded By</th>
                        <th className="px-6 py-4 font-medium">Upload Date</th>
                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeTab === "alerts" && alerts.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No alerts found</td></tr>
                    )}
                    {activeTab === "logs" && logs.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No activity logs found</td></tr>
                    )}
                    {activeTab === "files" && files.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No files uploaded yet</td></tr>
                    )}

                    {activeTab === "alerts" && alerts.map((alert) => (
                      <tr key={alert.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs">{alert.id}</td>
                        <td className="px-6 py-4">{alert.User?.email || "N/A"}</td>
                        <td className="px-6 py-4">{alert.department || alert.User?.department || "N/A"}</td>
                        <td className="px-6 py-4">{alert.action || "N/A"}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            (alert.riskScore || 0) >= 80 ? "bg-destructive/20 text-destructive" :
                            (alert.riskScore || 0) >= 50 ? "bg-warning/20 text-warning" :
                            "bg-success/20 text-success"
                          }`}>
                            {alert.riskScore}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            alert.status === "RESOLVED" || alert.status === "true" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                          }`}>
                            {alert.status === "true" || alert.status === "RESOLVED" ? "RESOLVED" : "ACTIVE"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          {new Date(alert.createdAt).toLocaleString()}
                        </td>
                        {/* <td className="px-6 py-4 text-right">
                          {(alert.status !== "RESOLVED" && alert.status !== "true") && (
                            <button
                              onClick={() => resolveAlert(alert.id)}
                              disabled={resolvingId === alert.id}
                              className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                              {resolvingId === alert.id ? "Resolving..." : "Resolve"}
                            </button>
                          )}
                        </td> */}
                      </tr>
                    ))}

                    {activeTab === "logs" && logs.map((log) => (
                      <tr key={log.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono">{log.userId}</td>
                        <td className="px-6 py-4">{log.User?.email || "N/A"}</td>
                        {/* <td className="px-6 py-4">{log.User?.name || "N/A"}</td> */}
                        <td className="px-6 py-4">{log.department || "N/A"}</td>
                        <td className="px-6 py-4 font-medium">{log.action}</td>
                        <td className="px-6 py-4 text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                          {log.resource || "N/A"}
                        </td>
                        {/* <td className="px-6 py-4">{log.grantedBy?.email || "N/A"}</td> */}
                      </tr>
                    ))}

                    {activeTab === "files" && files.map((file) => (
                      <tr key={file.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-6 py-4 font-medium">{file.filename}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-secondary text-foreground">
                            {file.department || "N/A"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {file.User ? file.User.email : "Unknown"}
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          {new Date(file.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                               onClick={() => handleDownload(file.id, file.filename)}
                               className="p-2 bg-secondary text-foreground hover:bg-primary/20 hover:text-primary rounded transition-colors"
                               title="Download File"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                               onClick={() => alert(`Delete functionality for file ${file.id} is coming soon!`)}
                               className="p-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded transition-colors"
                               title="Delete File"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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

export default SOCDashboard;