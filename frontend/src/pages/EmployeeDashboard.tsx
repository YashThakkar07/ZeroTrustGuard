import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import UserProfileCard from "@/components/UserProfileCard";
import { Loader2, Download, Lock, FileText, X } from "lucide-react";
import api from "../api/axios";
import { PinModal } from "@/components/PinModal";
import { SecureFileViewer } from "@/components/SecureFileViewer";

interface FileItem {
  id: number;
  filename: string;
  originalName?: string;
  department: string;
  canView: boolean;
  canDownload: boolean;
  createdAt: string;
}

const EmployeeDashboard = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [fileToProcess, setFileToProcess] = useState<{id: number, filename: string, originalName: string, action: 'view' | 'download'} | null>(null);
  const [downloadPinError, setDownloadPinError] = useState("");

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerFilename, setViewerFilename] = useState<string>("");

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await api.get("/api/files/my-files");
      setFiles(res.data.files);
    } catch (err: any) {
      setError(err.response?.data?.message || "Network error. Could not fetch files.");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (id: number, filename: string, originalName: string, action: 'view' | 'download') => {
    setFileToProcess({ id, filename, originalName, action });
    setDownloadPinError("");
    setPinModalOpen(true);
  };

  const closeViewer = () => {
    if (viewerUrl) {
      window.URL.revokeObjectURL(viewerUrl);
      setViewerUrl(null);
      setViewerFilename("");
    }
  };

  const processAction = async (pin: string) => {
    if (!fileToProcess) return;

    if (fileToProcess.action === 'view') {
      try {
        const res = await api.get(`/api/files/view/${fileToProcess.id}`, {
          responseType: "blob",
          headers: { "x-mfa-pin": pin }
        });
        const mimeType = res.headers['content-type'] || 'application/octet-stream';
        const blob = new Blob([res.data], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        
        setViewerUrl(url);
        setViewerFilename(fileToProcess.originalName || fileToProcess.filename);

        setPinModalOpen(false);
        setFileToProcess(null);
      } catch (err: any) {
        if (err.response && err.response.data instanceof Blob) {
          const text = await err.response.data.text();
          try {
              const data = JSON.parse(text);
              if (data.mfaRequired) {
                  setDownloadPinError(data.message || "Invalid PIN");
                  return;
              }
              alert(data.message || "View failed.");
          } catch {
              alert("View failed.");
          }
        } else {
          alert(err.response?.data?.message || "Network error during view.");
        }
        setPinModalOpen(false);
      }
    } else {
      try {
        const res = await api.get(`/api/files/download/${fileToProcess.id}`, {
          responseType: "blob",
          headers: { "x-mfa-pin": pin }
        });

        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement("a");
        a.href = url;
        a.download = fileToProcess.originalName || fileToProcess.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        setPinModalOpen(false);
        setFileToProcess(null);
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
    }
  };

  const openRequestModal = (fileId: number) => {
    setSelectedFileId(fileId);
    setReason("");
    setRequestModalOpen(true);
  };

  const submitAccessRequest = async () => {
    if (!reason.trim()) {
      alert("Please provide a reason.");
      return;
    }

    setRequestLoading(true);
    try {
      await api.post("/api/files/request-access", {
        fileId: selectedFileId,
        reason,
      });

      alert("Access requested successfully!");
      setRequestModalOpen(false);
      setSelectedFileId(null);
    } catch (err: any) {
      alert(err.response?.data?.message || "Network error or failed to request access.");
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar />
      <PinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSubmit={processAction}
        error={downloadPinError}
        title={fileToProcess?.action === 'view' ? "View Secured File" : "Download Secured File"}
        description={`Enter PIN to ${fileToProcess?.action} ${fileToProcess?.originalName || fileToProcess?.filename}`}
      />
      
      <SecureFileViewer
        url={viewerUrl}
        filename={viewerFilename}
        onClose={closeViewer}
      />

      <main className="flex-1 p-8 relative overflow-y-auto">
        <div className="absolute top-6 right-8 z-50">
          <UserProfileCard />
        </div>

        <div className="max-w-4xl mx-auto mt-4">
          <div className="mb-8">
            <h1 className="text-2xl font-bold">Department File Access</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and request access to files in your department.
            </p>
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
          ) : files.length === 0 ? (
            <div className="text-center p-10 bg-secondary/50 rounded-lg border border-border">
              <p className="text-muted-foreground">No files found for your department.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {files.map((file) => (
                <div key={file.id} className="glass-card p-6 border border-border flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-secondary rounded-lg">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    {!file.canView && !file.canDownload && (
                      <Lock className="w-5 h-5 text-warning" />
                    )}
                  </div>

                  <h3 className="font-semibold text-lg truncate mb-1" title={file.originalName || file.filename}>
                    {file.originalName || file.filename}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Added: {new Date(file.createdAt).toLocaleDateString()}
                  </p>

                  <div className="mt-auto pt-4 border-t border-border flex gap-2">
                    {file.canView ? (
                      <>
                        <button
                           onClick={() => handleAction(file.id, file.filename, file.originalName || file.filename, 'view')}
                          className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition flex items-center justify-center gap-2 text-sm font-medium"
                        >
                          <FileText className="w-4 h-4" />
                          View
                        </button>
                        {file.canDownload && (
                          <button
                            onClick={() => handleAction(file.id, file.filename, file.originalName || file.filename, 'download')}
                            className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition flex items-center justify-center gap-2 text-sm font-medium"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => openRequestModal(file.id)}
                        className="w-full py-2 px-4 bg-secondary text-foreground rounded hover:bg-secondary/80 transition flex items-center justify-center gap-2 text-sm font-medium border border-border"
                      >
                        <Lock className="w-4 h-4" />
                        Request Access
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Request Access Modal */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md p-6 rounded-lg shadow-lg border border-border relative">
            <button
              onClick={() => setRequestModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-4">Request Access</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Please provide a business justification for needing access to this file.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Needed for Q3 financial review..."
              className="w-full h-32 p-3 bg-background border border-border rounded-md text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRequestModalOpen(false)}
                className="px-4 py-2 rounded-md hover:bg-secondary transition text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={submitAccessRequest}
                disabled={requestLoading || !reason.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {requestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;