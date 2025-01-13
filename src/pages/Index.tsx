import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthComponent } from "@/components/auth/AuthComponent";
import { FileUpload } from "@/components/files/FileUpload";
import { FileList } from "@/components/files/FileList";

const Index = () => {
  const [session, setSession] = useState(null);

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

  if (!session) {
    return <AuthComponent />;
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

      <FileUpload 
        userId={session.user.id} 
        onUploadComplete={() => {
          // This will trigger a re-render of FileList
          const event = new CustomEvent('fileUploaded');
          window.dispatchEvent(event);
        }} 
      />
      <FileList />
    </div>
  );
};

export default Index;