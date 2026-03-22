import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import UserProfileCard from "@/components/UserProfileCard";
import { Loader2, CheckCircle, XCircle, Clock, ShieldAlert } from "lucide-react";
import api from "../api/axios";

interface AccessRequest {
  id: number;
  reason: string;
  createdAt: string;
  Requester: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  File: {
    id: number;
    filename: string;
    department: string;
  };
}

interface MfaRequest {
  id: number;
  status: string;
  createdAt: string;
  User?: {
    id: number;
    email: string;
    name: string;
  };
}

const ApprovalsDashboard = () => {
  const [activeTab, setActiveTab] = useState<"access" | "mfa">("access");
  
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [mfaRequests, setMfaRequests] = useState<MfaRequest[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  // States for duration dropdown
  const [approveDuration, setApproveDuration] = useState<Record<number, string>>({});
  const [approveDownload, setApproveDownload] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (activeTab === "access") {
      fetchRequests();
    } else {
      fetchMfaRequests();
    }
  }, [activeTab]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/access-requests/pending");
      setRequests(res.data.requests || []);
    } catch (err: any) {
      setError(err.response?.data?.message || "Network error. Could not fetch requests.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMfaRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/mfa/requests");
      setMfaRequests(res.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || "Network error. Could not fetch MFA requests.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    const duration = approveDuration[id] || "1_hour";
    const allowDownload = approveDownload[id] || false;
    setProcessingId(id);
    try {
      await api.post(`/api/access-requests/${id}/approve`, { duration, allowDownload });
      setRequests(requests.filter(req => req.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || "Network error or failure to approve.");
    } setProcessingId(null);
  };

  const handleReject = async (id: number) => {
    setProcessingId(id);
    try {
      await api.post(`/api/access-requests/${id}/reject`, {});
      setRequests(requests.filter(req => req.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || "Network error or failure to reject.");
    } setProcessingId(null);
  };

  const handleMfaApprove = async (id: number) => {
    setProcessingId(id);
    try {
      await api.post(`/api/mfa/approve/${id}`, {});
      setMfaRequests(mfaRequests.filter(req => req.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || "Failure to approve MFA reset.");
    } setProcessingId(null);
  };

  const handleMfaReject = async (id: number) => {
    setProcessingId(id);
    try {
      await api.post(`/api/mfa/reject/${id}`, {});
      setMfaRequests(mfaRequests.filter(req => req.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || "Failure to reject MFA reset.");
    } setProcessingId(null);
  };

  const handleDurationChange = (id: number, duration: string) => {
    setApproveDuration({ ...approveDuration, [id]: duration });
  };

  const handleDownloadChange = (id: number, allowed: boolean) => {
    setApproveDownload({ ...approveDownload, [id]: allowed });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar />
      
      <main className="flex-1 p-8 relative overflow-y-auto">
        <div className="absolute top-6 right-8 z-50">
          <UserProfileCard />
        </div>

        <div className="max-w-5xl mx-auto mt-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Admin Approvals</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage pending requests for your organization.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border mb-6">
            <button
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === "access"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
              onClick={() => setActiveTab("access")}
            >
              File Access
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === "mfa"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
              onClick={() => setActiveTab("mfa")}
            >
              MFA Resets
            </button>
          </div>

          {error && (
            <div className="p-4 mb-6 rounded bg-destructive/10 border border-destructive/20 text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center mt-20">
              <Loader2 className="animate-spin w-8 h-8 text-primary" />
            </div>
          ) : activeTab === "access" && requests.length === 0 ? (
            <div className="text-center p-10 bg-secondary/50 rounded-lg border border-border">
              <p className="text-muted-foreground">No pending file access requests.</p>
            </div>
          ) : activeTab === "mfa" && mfaRequests.length === 0 ? (
            <div className="text-center p-10 bg-secondary/50 rounded-lg border border-border">
              <p className="text-muted-foreground">No pending MFA reset requests.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {activeTab === "access" && requests.map((req) => (
                <div key={req.id} className="glass-card p-6 border border-border flex flex-col md:flex-row gap-6 md:items-center justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-1 bg-secondary rounded text-muted-foreground uppercase tracking-wider">
                        Request #{req.id}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(req.createdAt).toLocaleString()}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-bold">
                      {req.File?.filename || "Unknown File"}
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        ({req.File?.department || "N/A"})
                      </span>
                    </h3>
                    
                    <div className="text-sm border-l-2 border-primary/50 pl-3 py-1 my-2">
                      <p className="text-foreground"><span className="text-muted-foreground">Requester:</span> {req.Requester?.name || req.Requester?.email} ({req.Requester?.role})</p>
                      <p className="text-foreground mt-1"><span className="text-muted-foreground">Reason:</span> {req.reason}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 min-w-[200px] p-4 bg-secondary/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <select 
                        value={approveDuration[req.id] || "1_hour"}
                        onChange={(e) => handleDurationChange(req.id, e.target.value)}
                        className="bg-background border border-border text-foreground text-xs rounded p-1 flex-1"
                      >
                        <option value="30_minutes">30 Minutes</option>
                        <option value="1_hour">1 Hour</option>
                        <option value="2_hours">2 Hours</option>
                        <option value="1_day">1 Day</option>
                      </select>
                    </div>
                    
                    <div className="flex gap-2 items-center px-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs group">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            checked={approveDownload[req.id] || false}
                            onChange={(e) => handleDownloadChange(req.id, e.target.checked)}
                            className="peer appearance-none w-4 h-4 rounded-sm border border-border bg-background checked:bg-primary checked:border-primary transition-all duration-200 cursor-pointer"
                          />
                          <svg className="absolute w-3 h-3 text-primary-foreground opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                        <span className="text-muted-foreground group-hover:text-foreground transition-colors select-none">Allow Download</span>
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={processingId === req.id}
                        className="flex-1 py-2 bg-success/10 text-success border border-success/20 hover:bg-success/20 rounded-md transition text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={processingId === req.id}
                        className="flex-1 py-2 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 rounded-md transition text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {activeTab === "mfa" && mfaRequests.map((req) => (
                <div key={req.id} className="glass-card p-6 border border-border flex flex-col md:flex-row gap-6 md:items-center justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-1 bg-warning/20 rounded text-warning uppercase tracking-wider">
                        MFA Reset
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(req.createdAt).toLocaleString()}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-warning" />
                      PIN Reset Requested
                    </h3>
                    
                    <div className="text-sm border-l-2 border-primary/50 pl-3 py-1 my-2">
                      <p className="text-foreground"><span className="text-muted-foreground">User:</span> {req.User?.name || "N/A"} ({req.User?.email})</p>
                      <p className="text-muted-foreground mt-1 text-xs">Approving this will clear the user's current MFA PIN and allow them to set a new one on their next login or from their settings.</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 min-w-[200px] p-4 bg-secondary/30 rounded-lg border border-border/50 justify-center">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleMfaApprove(req.id)}
                        disabled={processingId === req.id}
                        className="flex-1 py-2 bg-success/10 text-success border border-success/20 hover:bg-success/20 rounded-md transition text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleMfaReject(req.id)}
                        disabled={processingId === req.id}
                        className="flex-1 py-2 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 rounded-md transition text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}

            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ApprovalsDashboard;
