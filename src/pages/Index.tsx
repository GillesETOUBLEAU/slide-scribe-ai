import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Index = () => {
  const [session, setSession] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchFiles();
    }
  }, [session]);

  const fetchFiles = async () => {
    const { data, error } = await supabase
      .from("file_conversions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error fetching files",
        description: error.message,
      });
      return;
    }

    setFiles(data || []);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !file.name.endsWith(".pptx")) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please upload a PPTX file",
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Upload PPTX file
      const pptxPath = `${session.user.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("pptx_files")
        .upload(pptxPath, file);

      if (uploadError) throw uploadError;

      // Create file conversion record
      const { error: dbError } = await supabase.from("file_conversions").insert({
        user_id: session.user.id, // Add the user_id field
        original_filename: file.name,
        pptx_path: pptxPath,
      });

      if (dbError) throw dbError;

      toast({
        title: "File uploaded successfully",
        description: "Your file is being processed",
      });

      fetchFiles();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const downloadFile = async (path, filename) => {
    try {
      const { data, error } = await supabase.storage
        .from("pptx_files")
        .download(path);

      if (error) throw error;

      const blob = new Blob([data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: error.message,
      });
    }
  };

  if (!session) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">
          PPTX Content Extractor
        </h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="light"
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">PPTX Content Extractor</h1>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Sign Out
        </button>
      </div>

      <div className="mb-8">
        <Input
          type="file"
          accept=".pptx"
          onChange={handleFileUpload}
          disabled={uploading}
        />
        {uploading && <Progress value={progress} className="mt-2" />}
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Filename</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => (
              <TableRow key={file.id}>
                <TableCell>{file.original_filename}</TableCell>
                <TableCell>{file.status}</TableCell>
                <TableCell>
                  {new Date(file.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="space-x-2">
                    {file.json_path && (
                      <button
                        onClick={() =>
                          downloadFile(
                            file.json_path,
                            file.original_filename.replace(".pptx", ".json")
                          )
                        }
                        className="text-blue-600 hover:text-blue-800"
                      >
                        JSON
                      </button>
                    )}
                    {file.markdown_path && (
                      <button
                        onClick={() =>
                          downloadFile(
                            file.markdown_path,
                            file.original_filename.replace(".pptx", ".md")
                          )
                        }
                        className="text-blue-600 hover:text-blue-800"
                      >
                        MD
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Index;