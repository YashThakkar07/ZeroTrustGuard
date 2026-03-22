import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { Upload } from "lucide-react";
import api from "../api/axios";

const FileManagement = () => {

const role = localStorage.getItem("ztg_role") || "intern";

const [file, setFile] = useState<File | null>(null);

const [allowIntern, setAllowIntern] = useState(false);
const [allowStaff, setAllowStaff] = useState(true);
const [allowSenior, setAllowSenior] = useState(true);

const [sensitivity, setSensitivity] = useState("low");

const uploadFile = async () => {

if (!file) {
  alert("Select file first");
  return;
}

const formData = new FormData();

formData.append("file", file);
formData.append("allowIntern", String(allowIntern));
formData.append("allowStaff", String(allowStaff));
formData.append("allowSenior", String(allowSenior));
formData.append("sensitivityLevel", sensitivity);

try {

  const res = await api.post("/api/files/upload", formData);

  alert(res.data?.message || "File uploaded successfully");

  setFile(null);
  setAllowIntern(false);
  setAllowStaff(true);
  setAllowSenior(true);
  setSensitivity("low");

} catch (error) {

  alert("File upload failed");
  console.error(error);

}


};

return (


<div className="flex min-h-screen bg-background">

  <AppSidebar />

  <main className="flex-1 p-8 text-foreground">

    <h1 className="text-2xl font-bold mb-6">
      File Management
    </h1>

    <div className="glass-card p-6 max-w-xl space-y-6">

      {/* FILE INPUT */}
      <div>

        <label className="text-sm text-muted-foreground">
          Select File
        </label>

        <div className="mt-2 flex items-center gap-3">

          <label className="cursor-pointer bg-secondary border border-border px-4 py-2 rounded-md hover:bg-secondary/80">
            Choose File
            <input
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>

          {file && (
            <span className="text-sm text-muted-foreground">
              {file.name}
            </span>
          )}

        </div>

      </div>

      {/* ACCESS PERMISSIONS */}
      <div>

        <label className="text-sm text-muted-foreground">
          Access Permissions
        </label>

        <div className="flex gap-6 mt-3">

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allowIntern}
              onChange={(e) => setAllowIntern(e.target.checked)}
            />
            Intern
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allowStaff}
              onChange={(e) => setAllowStaff(e.target.checked)}
            />
            Staff
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allowSenior}
              onChange={(e) => setAllowSenior(e.target.checked)}
            />
            Senior
          </label>

        </div>

      </div>

      {/* SENSITIVITY */}
      <div>

        <label className="text-sm text-muted-foreground">
          Sensitivity Level
        </label>

        <select
          value={sensitivity}
          className="mt-2 w-full bg-secondary text-foreground p-2 rounded-md border border-border"
          onChange={(e) => setSensitivity(e.target.value)}
        >

          <option value="low">Low</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>

        </select>

      </div>

      {/* UPLOAD BUTTON */}
      <button
        onClick={uploadFile}
        className="flex items-center gap-2 bg-primary hover:bg-primary/90 px-4 py-2 rounded-lg text-white"
      >
        <Upload size={16} />
        Upload File
      </button>

    </div>

  </main>

</div>

);
};

export default FileManagement;
